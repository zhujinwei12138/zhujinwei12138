import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Order, Payment
from schemas import PaymentCreateIn, PaymentOut, RefundIn
import redis_client as rc

router = APIRouter(prefix="/api/payments", tags=["payments"])

PAYMENT_TTL = 15 * 60  # 15 minutes in seconds
REDIS_KEY = "payment:{id}:status"


def _redis_key(pay_id: str) -> str:
    return f"payment:{pay_id}:status"


@router.get("", response_model=list[PaymentOut])
async def list_payments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Payment).order_by(Payment.created_at.desc()))
    return result.scalars().all()


@router.post("/create", response_model=PaymentOut)
async def create_payment(body: PaymentCreateIn, db: AsyncSession = Depends(get_db)):
    order = await db.get(Order, body.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "pending_payment":
        raise HTTPException(400, f"Order is already {order.status}")

    # Reuse existing pending payment
    existing = await db.execute(
        select(Payment).where(Payment.order_id == body.order_id, Payment.status == "pending")
    )
    payment = existing.scalar_one_or_none()
    if payment:
        payment.method = body.method
        await db.commit()
        await db.refresh(payment)
        return payment

    pay_id = "PAY" + secrets.token_hex(8).upper()
    now = datetime.now(timezone.utc)
    payment = Payment(
        id=pay_id,
        order_id=order.id,
        merchant_id=order.merchant_id,
        amount=float(order.total),
        method=body.method,
        status="pending",
        expired_at=now + timedelta(seconds=PAYMENT_TTL),
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    # Cache status in Redis with TTL — polling reads from here first
    await rc.redis.setex(_redis_key(pay_id), PAYMENT_TTL, "pending")
    return payment


@router.get("/{pay_id}", response_model=PaymentOut)
async def get_payment(pay_id: str, db: AsyncSession = Depends(get_db)):
    # Fast path: read from Redis
    cached_status = await rc.redis.get(_redis_key(pay_id))

    payment = await db.get(Payment, pay_id)
    if not payment:
        raise HTTPException(404, "Payment not found")

    # If Redis key expired and DB still shows pending → mark expired
    if cached_status is None and payment.status == "pending":
        payment.status = "expired"
        await db.commit()
        await db.refresh(payment)
    elif cached_status and cached_status != payment.status:
        # Redis is source of truth for live status
        payment.status = cached_status

    return payment


@router.post("/{pay_id}/mock-pay", response_model=dict)
async def mock_pay(pay_id: str, db: AsyncSession = Depends(get_db)):
    """Simulate a successful payment (demo only). Replace with real gateway webhook in production."""
    payment = await db.get(Payment, pay_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != "pending":
        raise HTTPException(400, f"Payment is already {payment.status}")

    now = datetime.now(timezone.utc)
    payment.status = "paid"
    payment.paid_at = now
    payment.transaction_id = "TXN" + secrets.token_hex(6).upper()

    order = await db.get(Order, payment.order_id)
    if order:
        order.status = "paid"
        order.paid_at = now

    await db.commit()

    # Update Redis — keeps polling consistent
    await rc.redis.setex(_redis_key(pay_id), 86400, "paid")
    return {"ok": True}


@router.post("/callback/{gateway}")
async def payment_callback(gateway: str, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Real payment gateway callback endpoint.
    WeChat Pay posts XML; Alipay posts form-encoded params.
    Both are normalised to JSON here for simplicity — adapt signature
    verification per gateway spec before production use.
    """
    body = await request.json()
    pay_id = body.get("out_trade_no") or body.get("payId")
    txn_id = body.get("transaction_id") or body.get("trade_no")

    if not pay_id:
        return _gateway_response(gateway, success=False)

    payment = await db.get(Payment, pay_id)
    if not payment:
        return _gateway_response(gateway, success=False)
    if payment.status == "paid":
        return _gateway_response(gateway, success=True)  # idempotent

    now = datetime.now(timezone.utc)
    payment.status = "paid"
    payment.paid_at = now
    payment.transaction_id = txn_id or ("TXN" + secrets.token_hex(6).upper())
    payment.gateway = gateway

    order = await db.get(Order, payment.order_id)
    if order:
        order.status = "paid"
        order.paid_at = now

    await db.commit()
    await rc.redis.setex(_redis_key(pay_id), 86400, "paid")
    return _gateway_response(gateway, success=True)


def _gateway_response(gateway: str, success: bool):
    code = "SUCCESS" if success else "FAIL"
    if gateway == "wechat":
        return {"return_code": code, "return_msg": "OK"}
    return "success" if success else "fail"


@router.post("/{pay_id}/refund", response_model=dict)
async def refund_payment(pay_id: str, body: RefundIn, db: AsyncSession = Depends(get_db)):
    payment = await db.get(Payment, pay_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != "paid":
        raise HTTPException(400, "Only paid payments can be refunded")

    now = datetime.now(timezone.utc)
    payment.status = "refunded"
    payment.refunded_at = now
    payment.refund_reason = body.reason

    order = await db.get(Order, payment.order_id)
    if order:
        order.status = "refunded"
        order.refunded_at = now

    await db.commit()
    await rc.redis.setex(_redis_key(pay_id), 86400, "refunded")
    return {"ok": True}
