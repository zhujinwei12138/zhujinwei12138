from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import verify_admin
from database import get_db
from models import Order
from schemas import OrderIn, OrderOut, OrderStatusIn

router = APIRouter(prefix="/api/orders", tags=["orders"])

ALLOWED_STATUS_TRANSITIONS = {
    "paid": ["preparing", "cancelled"],
    "preparing": ["completed", "cancelled"],
}


@router.get("", response_model=list[OrderOut], dependencies=[Depends(verify_admin)])
async def list_orders(skip: int = 0, limit: int = 200, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).order_by(Order.id.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{order_id}", response_model=OrderOut, dependencies=[Depends(verify_admin)])
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@router.post("", response_model=OrderOut)
async def create_order(body: OrderIn, db: AsyncSession = Depends(get_db)):
    order = Order(
        merchant_id=body.merchant_id,
        table_no=body.table_no,
        items=[item.model_dump() for item in body.items],
        total=body.total,
        status="pending_payment",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


@router.put("/{order_id}/status", response_model=OrderOut, dependencies=[Depends(verify_admin)])
async def update_order_status(order_id: int, body: OrderStatusIn, db: AsyncSession = Depends(get_db)):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    allowed = ALLOWED_STATUS_TRANSITIONS.get(order.status, [])
    if body.status not in allowed:
        raise HTTPException(400, f"Cannot transition {order.status} → {body.status}")
    now = datetime.now(timezone.utc)
    order.status = body.status
    setattr(order, f"{body.status}_at", now)
    await db.commit()
    await db.refresh(order)
    return order
