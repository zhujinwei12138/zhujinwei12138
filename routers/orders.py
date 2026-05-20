import asyncio
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from audit import record as audit_record
from auth import decode_customer_id_optional, require_merchant_scope, scoped_merchant_id, verify_admin
from database import get_db
from models import Merchant, Order, Product
from schemas import OrderIn, OrderOut, OrderStatusIn
import redis_client as rc

_BTABLE_RATE_PREFIX = "rate:by_table:"  # per IP, 30 req/min
_CANCEL_RATE_PREFIX = "rate:cancel:"    # per IP, 5 req/min

_optional_bearer = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/orders", tags=["orders"])
logger = logging.getLogger(__name__)

ALLOWED_STATUS_TRANSITIONS = {
    "pending_payment": ["cancelled"],          # admin can cancel unpaid orders
    "paid": ["preparing", "completed", "cancelled"],  # completed allowed without preparing step
    "preparing": ["completed", "cancelled"],
}

_TERMINAL_STATUSES = {"completed", "cancelled", "refunded"}


async def _publish_order_status(order_id: int, status: str) -> None:
    channel = f"order:{order_id}:status"
    await rc.redis.publish(channel, json.dumps({"id": order_id, "status": status}))


@router.get("", response_model=list[OrderOut])
async def list_orders(
    skip: int = Query(0, ge=0, le=100_000),
    limit: int = Query(200, ge=1, le=1000),
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Order).order_by(Order.id.desc()).offset(skip).limit(limit)
    mid = scoped_merchant_id(admin)
    if mid is not None:
        stmt = stmt.where(Order.merchant_id == mid)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/by-table", response_model=list[OrderOut])
async def orders_by_table(
    request: Request,
    merchant_id: int = Query(..., gt=0),
    table_no: str = Query(..., min_length=1, max_length=20),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = _BTABLE_RATE_PREFIX + client_ip
    count = await rc.redis.get(rate_key)
    if count and int(count) >= 30:
        raise HTTPException(429, "请求过于频繁，请稍后重试")
    async with rc.redis.pipeline(transaction=False) as pipe:
        await pipe.incr(rate_key)
        await pipe.expire(rate_key, 60)
        await pipe.execute()

    result = await db.execute(
        select(Order)
        .where(Order.merchant_id == merchant_id, Order.table_no == table_no)
        .order_by(Order.id.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{order_id}/status")
async def get_order_status(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return {"id": order.id, "status": order.status}


@router.get("/{order_id}/stream")
async def stream_order_status(order_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """SSE — 实时推送订单状态变更，替代前端轮询。"""
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    initial_status = order.status

    async def event_generator():
        yield f"data: {json.dumps({'id': order_id, 'status': initial_status})}\n\n"

        if initial_status in _TERMINAL_STATUSES:
            return

        pubsub = rc.redis.pubsub()
        channel = f"order:{order_id}:status"
        await pubsub.subscribe(channel)
        try:
            deadline = asyncio.get_event_loop().time() + 300  # 5-minute timeout
            while True:
                if await request.is_disconnected():
                    break
                if asyncio.get_event_loop().time() > deadline:
                    break
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    data = json.loads(msg["data"])
                    yield f"data: {json.dumps(data)}\n\n"
                    if data.get("status") in _TERMINAL_STATUSES:
                        break
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    require_merchant_scope(admin, order.merchant_id)
    return order


@router.post("", response_model=OrderOut)
async def create_order(
    body: OrderIn,
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
):
    merchant = await db.get(Merchant, body.merchant_id)
    if not merchant or merchant.status != "active":
        raise HTTPException(404, "商家不存在或已停业")

    products_map: dict[int, Product] = {}
    for item in body.items:
        result = await db.execute(
            select(Product).where(Product.id == item.id).with_for_update()
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(404, f"商品 ID {item.id} 不存在")
        if product.stock is not None and product.stock < item.quantity:
            raise HTTPException(400, f"商品「{product.name}」库存不足，当前剩余：{product.stock}")
        if product.stock is not None:
            product.stock -= item.quantity
        products_map[item.id] = product

    # Use server-side prices — prevents client price manipulation and ensures accurate audit trail
    server_total = float(
        sum(Decimal(str(products_map[i.id].price)) * i.quantity for i in body.items)
        .quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    )
    server_items = [
        {**item.model_dump(), "price": float(products_map[item.id].price)}
        for item in body.items
    ]

    # customer_id must come from a valid customer token, never from untrusted request body
    customer_id: Optional[str] = None
    if credentials:
        customer_id = decode_customer_id_optional(credentials.credentials)

    order = Order(
        merchant_id=body.merchant_id,
        table_no=body.table_no,
        items=server_items,
        total=server_total,
        status="pending_payment",
        customer_id=customer_id,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


@router.post("/{order_id}/customer-cancel")
async def customer_cancel_order(order_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Customer-accessible cancel — only allowed for pending_payment orders (not yet paid)."""
    client_ip = request.client.host if request.client else "unknown"
    rate_key = _CANCEL_RATE_PREFIX + client_ip
    count = await rc.redis.get(rate_key)
    if count and int(count) >= 5:
        raise HTTPException(429, "操作过于频繁，请稍后再试")
    async with rc.redis.pipeline(transaction=False) as pipe:
        await pipe.incr(rate_key)
        await pipe.expire(rate_key, 60)
        await pipe.execute()

    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "pending_payment":
        raise HTTPException(400, "只能取消待付款的订单，如需退款请联系商家")
    order.status = "cancelled"
    order.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.put("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: int,
    body: OrderStatusIn,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    require_merchant_scope(admin, order.merchant_id)
    allowed = ALLOWED_STATUS_TRANSITIONS.get(order.status, [])
    if body.status not in allowed:
        raise HTTPException(400, f"Cannot transition {order.status} → {body.status}")
    now = datetime.now(timezone.utc)
    order.status = body.status
    setattr(order, f"{body.status}_at", now)
    await audit_record(
        db, actor=admin["sub"], action="STATUS_CHANGE", resource="orders",
        resource_id=str(order_id), detail={"status": body.status},
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(order)
    await _publish_order_status(order_id, body.status)
    return order
