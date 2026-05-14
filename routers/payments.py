import hashlib
import hmac
import json
import logging
import os
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import verify_admin
from database import get_db
from models import Order, Payment
from schemas import PaymentCreateIn, PaymentOut, RefundIn
import redis_client as rc

router = APIRouter(prefix="/api/payments", tags=["payments"])
logger = logging.getLogger(__name__)

PAYMENT_TTL = 15 * 60  # 15 minutes in seconds


def _redis_key(pay_id: str) -> str:
    return f"payment:{pay_id}:status"


@router.get("", response_model=list[PaymentOut], dependencies=[Depends(verify_admin)])
async def list_payments(skip: int = 0, limit: int = 200, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Payment).order_by(Payment.created_at.desc()).offset(skip).limit(limit)
    )
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

    await rc.redis.setex(_redis_key(pay_id), PAYMENT_TTL, "pending")
    logger.info("Payment created: %s order=%s amount=%s", pay_id, order.id, payment.amount)
    return payment


@router.get("/{pay_id}", response_model=PaymentOut)
async def get_payment(pay_id: str, db: AsyncSession = Depends(get_db)):
    cached_status = await rc.redis.get(_redis_key(pay_id))

    payment = await db.get(Payment, pay_id)
    if not payment:
        raise HTTPException(404, "Payment not found")

    if cached_status is None and payment.status == "pending":
        payment.status = "expired"
        await db.commit()
        await db.refresh(payment)
    elif cached_status and cached_status != payment.status:
        payment.status = cached_status

    return payment


@router.post("/{pay_id}/mock-pay", response_model=dict)
async def mock_pay(pay_id: str, db: AsyncSession = Depends(get_db)):
    """Simulate a successful payment (demo only)."""
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
    await rc.redis.setex(_redis_key(pay_id), 86400, "paid")
    logger.info("Payment paid (mock): %s order=%s", pay_id, payment.order_id)
    return {"ok": True}


def _verify_gateway_signature(gateway: str, body_bytes: bytes, signature: str | None) -> bool:
    """Verify HMAC-SHA256 signature from payment gateway webhook.
    Set PAYMENT_WEBHOOK_SECRET env var to enable enforcement.
    """
    secret = os.getenv("PAYMENT_WEBHOOK_SECRET")
    if not secret:
        logger.warning("PAYMENT_WEBHOOK_SECRET not set; skipping signature verification for %s", gateway)
        return True
    if not signature:
        return False
    expected = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/callback/{gateway}")
async def payment_callback(gateway: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Real payment gateway callback endpoint."""
    body_bytes = await request.body()
    signature = request.headers.get("X-Signature")

    if not _verify_gateway_signature(gateway, body_bytes, signature):
        logger.warning("Invalid signature for gateway=%s", gateway)
        raise HTTPException(400, "Invalid signature")

    try:
        body = json.loads(body_bytes)
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

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
    logger.info("Payment paid (callback): %s gateway=%s", pay_id, gateway)
    return _gateway_response(gateway, success=True)


def _gateway_response(gateway: str, success: bool):
    code = "SUCCESS" if success else "FAIL"
    if gateway == "wechat":
        return {"return_code": code, "return_msg": "OK"}
    return "success" if success else "fail"


@router.post("/{pay_id}/refund", response_model=dict, dependencies=[Depends(verify_admin)])
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
    logger.info("Payment refunded: %s reason=%s", pay_id, body.reason)
    return {"ok": True}
