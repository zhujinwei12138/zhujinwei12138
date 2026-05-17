import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from audit import record as audit_record
from auth import require_merchant_scope, scoped_merchant_id, verify_admin
from database import get_db
from models import Order, Payment, Product
from schemas import PaymentCreateIn, PaymentOut, RefundIn
import redis_client as rc

router = APIRouter(prefix="/api/payments", tags=["payments"])
logger = logging.getLogger(__name__)

PAYMENT_TTL = 15 * 60  # 15 minutes in seconds
PAYMENT_MODE = os.getenv("PAYMENT_MODE", "mock")  # "mock" | "live"

# WeChat Pay v3
WECHAT_MCH_ID = os.getenv("WECHAT_MCH_ID", "")
WECHAT_APP_ID = os.getenv("WECHAT_APP_ID", "")
WECHAT_API_V3_KEY = os.getenv("WECHAT_API_V3_KEY", "")
WECHAT_CERT_SERIAL = os.getenv("WECHAT_CERT_SERIAL_NO", "")
WECHAT_PRIVATE_KEY_PATH = os.getenv("WECHAT_PRIVATE_KEY_PATH", "")

# Alipay
ALIPAY_APP_ID = os.getenv("ALIPAY_APP_ID", "")
ALIPAY_GATEWAY = os.getenv("ALIPAY_GATEWAY", "https://openapi.alipay.com/gateway.do")
ALIPAY_PRIVATE_KEY = os.getenv("ALIPAY_PRIVATE_KEY", "")
ALIPAY_PUBLIC_KEY = os.getenv("ALIPAY_PUBLIC_KEY", "")


def _redis_key(pay_id: str) -> str:
    return f"payment:{pay_id}:status"


def _txn_dedup_key(txn_id: str) -> str:
    return f"txn:processed:{txn_id}"


@router.get("", response_model=list[PaymentOut])
async def list_payments(
    skip: int = 0,
    limit: int = 200,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Payment).order_by(Payment.created_at.desc()).offset(skip).limit(limit)
    mid = scoped_merchant_id(admin)
    if mid is not None:
        stmt = stmt.where(Payment.merchant_id == mid)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/create", response_model=PaymentOut)
async def create_payment(body: PaymentCreateIn, db: AsyncSession = Depends(get_db)):
    order = await db.get(Order, body.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status != "pending_payment":
        raise HTTPException(400, f"Order is already {order.status}")

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
    """Simulate payment success — only available when PAYMENT_MODE=mock."""
    if PAYMENT_MODE != "mock":
        raise HTTPException(404, "Not found")

    payment = await db.get(Payment, pay_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != "pending":
        raise HTTPException(400, f"Payment is already {payment.status}")

    now = datetime.now(timezone.utc)
    payment.status = "paid"
    payment.paid_at = now
    payment.transaction_id = "MOCK" + secrets.token_hex(6).upper()

    order = await db.get(Order, payment.order_id)
    if order:
        order.status = "paid"
        order.paid_at = now

    await db.commit()
    await rc.redis.setex(_redis_key(pay_id), 86400, "paid")
    if order:
        await rc.redis.publish(f"order:{order.id}:status", json.dumps({"id": order.id, "status": "paid"}))
    logger.info("Payment paid (mock): %s order=%s", pay_id, payment.order_id)
    return {"ok": True}


# ── Real gateway helpers ──────────────────────────────────────────────────────

def _load_wechat_private_key():
    try:
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
        with open(WECHAT_PRIVATE_KEY_PATH, "rb") as f:
            return load_pem_private_key(f.read(), password=None)
    except Exception as e:
        raise HTTPException(500, f"Cannot load WeChat private key: {e}")


def _wechat_auth_header(method: str, url_path: str, body: str) -> str:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(16)
    message = f"{method}\n{url_path}\n{timestamp}\n{nonce}\n{body}\n"
    sig = _load_wechat_private_key().sign(message.encode(), padding.PKCS1v15(), hashes.SHA256())
    signature = base64.b64encode(sig).decode()
    return (
        f'WECHATPAY2-SHA256-RSA2048 mchid="{WECHAT_MCH_ID}",'
        f'nonce_str="{nonce}",signature="{signature}",'
        f'timestamp="{timestamp}",serial_no="{WECHAT_CERT_SERIAL}"'
    )


def _alipay_sign(params: dict) -> str:
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        sorted_params = sorted((k, v) for k, v in params.items() if v and k != "sign")
        sign_str = "&".join(f"{k}={v}" for k, v in sorted_params)
        key_bytes = base64.b64decode(ALIPAY_PRIVATE_KEY)
        private_key = serialization.load_der_private_key(key_bytes, password=None)
        sig = private_key.sign(sign_str.encode(), padding.PKCS1v15(), hashes.SHA256())
        return base64.b64encode(sig).decode()
    except Exception as e:
        raise HTTPException(500, f"Alipay sign error: {e}")


@router.post("/{pay_id}/prepay")
async def prepay(pay_id: str, db: AsyncSession = Depends(get_db)):
    """Create native payment order at gateway; returns QR code URL."""
    payment = await db.get(Payment, pay_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != "pending":
        raise HTTPException(400, f"Payment is already {payment.status}")

    if PAYMENT_MODE != "live":
        return {
            "method": payment.method,
            "mode": "mock",
            "message": "PAYMENT_MODE=mock，请配置真实网关凭据后切换到 live",
        }

    order = await db.get(Order, payment.order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    amount_fen = int(float(payment.amount) * 100)

    if payment.method == "wechat":
        if not all([WECHAT_MCH_ID, WECHAT_APP_ID, WECHAT_API_V3_KEY, WECHAT_CERT_SERIAL, WECHAT_PRIVATE_KEY_PATH]):
            raise HTTPException(500, "WeChat Pay config incomplete")
        url_path = "/v3/pay/transactions/native"
        body_dict = {
            "appid": WECHAT_APP_ID, "mchid": WECHAT_MCH_ID,
            "description": f"订单 #{payment.order_id}", "out_trade_no": pay_id,
            "notify_url": os.getenv("WECHAT_NOTIFY_URL", "https://example.com/api/payments/callback/wechat"),
            "amount": {"total": amount_fen, "currency": "CNY"},
        }
        body_str = json.dumps(body_dict, ensure_ascii=False)
        auth = _wechat_auth_header("POST", url_path, body_str)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.mch.weixin.qq.com{url_path}",
                content=body_str,
                headers={"Authorization": auth, "Content-Type": "application/json"},
                timeout=10,
            )
        if resp.status_code != 200:
            logger.error("WeChat prepay failed: %d", resp.status_code)
            raise HTTPException(502, "微信支付下单失败，请稍后重试")
        return {"method": "wechat", "code_url": resp.json().get("code_url", "")}

    else:  # alipay
        if not all([ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY]):
            raise HTTPException(500, "Alipay config incomplete")
        biz_content = json.dumps({
            "out_trade_no": pay_id,
            "total_amount": f"{float(payment.amount):.2f}",
            "subject": f"订单 #{payment.order_id}",
            "product_code": "FACE_TO_FACE_PAYMENT",
        })
        params = {
            "app_id": ALIPAY_APP_ID, "method": "alipay.trade.precreate",
            "charset": "utf-8", "sign_type": "RSA2",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "version": "1.0",
            "notify_url": os.getenv("ALIPAY_NOTIFY_URL", "https://example.com/api/payments/callback/alipay"),
            "biz_content": biz_content,
        }
        params["sign"] = _alipay_sign(params)
        async with httpx.AsyncClient() as client:
            resp = await client.post(ALIPAY_GATEWAY, data=params, timeout=10)
        result = resp.json().get("alipay_trade_precreate_response", {})
        if result.get("code") != "10000":
            logger.error("Alipay prepay failed: %s", result.get("sub_msg"))
            raise HTTPException(502, "支付宝下单失败，请稍后重试")
        return {"method": "alipay", "code_url": result.get("qr_code", "")}


# ── Gateway callback ──────────────────────────────────────────────────────────

def _verify_gateway_signature(gateway: str, body_bytes: bytes, signature: str | None) -> bool:
    secret = os.getenv("PAYMENT_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(500, "Server misconfigured: PAYMENT_WEBHOOK_SECRET not set")
    if not signature:
        return False
    expected = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/callback/{gateway}")
async def payment_callback(gateway: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Payment gateway webhook — with signature verification and replay protection."""
    body_bytes = await request.body()
    signature = request.headers.get("X-Signature")

    if not _verify_gateway_signature(gateway, body_bytes, signature):
        logger.warning("Invalid signature gateway=%s ip=%s", gateway, request.client.host if request.client else "-")
        raise HTTPException(400, "Invalid signature")

    # Replay protection: reject callbacks older than 5 minutes
    cb_timestamp = request.headers.get("X-Timestamp")
    if cb_timestamp:
        try:
            if abs(time.time() - float(cb_timestamp)) > 300:
                raise HTTPException(400, "Callback timestamp expired")
        except ValueError:
            raise HTTPException(400, "Invalid timestamp")

    try:
        body = json.loads(body_bytes)
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    pay_id = body.get("out_trade_no") or body.get("payId")
    txn_id = body.get("transaction_id") or body.get("trade_no")

    if not pay_id:
        return _gateway_response(gateway, success=False)

    # Deduplicate: ignore already-processed transaction IDs
    if txn_id:
        already = await rc.redis.get(_txn_dedup_key(txn_id))
        if already:
            logger.info("Duplicate callback ignored: txn=%s", txn_id)
            return _gateway_response(gateway, success=True)

    payment = await db.get(Payment, pay_id)
    if not payment:
        return _gateway_response(gateway, success=False)
    if payment.status == "paid":
        return _gateway_response(gateway, success=True)

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
    if order:
        await rc.redis.publish(f"order:{order.id}:status", json.dumps({"id": order.id, "status": "paid"}))

    if txn_id:
        await rc.redis.setex(_txn_dedup_key(txn_id), 86400, "1")

    logger.info("Payment paid (callback): %s gateway=%s txn=%s", pay_id, gateway, payment.transaction_id)
    return _gateway_response(gateway, success=True)


def _gateway_response(gateway: str, success: bool):
    code = "SUCCESS" if success else "FAIL"
    if gateway == "wechat":
        return {"return_code": code, "return_msg": "OK"}
    return "success" if success else "fail"


# ── Refund (P2#13: restore stock) ────────────────────────────────────────────

@router.post("/{pay_id}/refund", response_model=dict)
async def refund_payment(
    pay_id: str,
    body: RefundIn,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    payment = await db.get(Payment, pay_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    require_merchant_scope(admin, payment.merchant_id)
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

        # Restore product stock for each item in the refunded order
        for item in (order.items or []):
            item_id = item.get("id")
            qty = item.get("quantity", 0)
            if item_id and qty > 0:
                result = await db.execute(
                    select(Product).where(Product.id == item_id).with_for_update()
                )
                product = result.scalar_one_or_none()
                if product and product.stock is not None:
                    product.stock += qty
                    logger.info("Stock restored: product=%s qty=%s", item_id, qty)

    await audit_record(
        db, actor=admin["sub"], action="REFUND", resource="payments",
        resource_id=pay_id, detail={"reason": body.reason, "amount": float(payment.amount)},
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await rc.redis.setex(_redis_key(pay_id), 86400, "refunded")
    logger.info("Payment refunded: %s by=%s reason=%s", pay_id, admin["sub"], body.reason)
    return {"ok": True}
