import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Customer, Order
from schemas import CustomerOut, CustomerSendOTP, CustomerVerifyOTP, OrderOut
import redis_client as rc

router = APIRouter(prefix="/api/customers", tags=["customers"])
logger = logging.getLogger(__name__)

_OTP_TTL = 300          # 5 minutes
_TOKEN_TTL_HOURS = 72
_DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"

_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-this-before-production")
_ALGORITHM = "HS256"

# Rate limiting keys
_OTP_SEND_PREFIX = "otp_send:"      # per phone: 1/min
_OTP_IP_PREFIX = "otp_ip:"          # per IP: 10/5min
_OTP_VERIFY_PREFIX = "otp_verify:"  # per phone: max 5 attempts before OTP invalidated

_customer_bearer = HTTPBearer()


def _otp_key(phone: str) -> str:
    return f"otp:{phone}"


def _create_customer_token(customer_id: str, phone: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS)
    return jwt.encode(
        {"sub": customer_id, "phone": phone, "role": "customer", "exp": exp},
        _SECRET,
        algorithm=_ALGORITHM,
    )


def verify_customer_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
        if payload.get("role") != "customer":
            raise ValueError("not a customer token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(401, "Invalid token")


async def _check_otp_rate(phone: str, client_ip: str) -> None:
    """Raise 429 if phone or IP exceeds send-OTP rate limits."""
    phone_key = _OTP_SEND_PREFIX + phone
    ip_key = _OTP_IP_PREFIX + client_ip

    phone_count = await rc.redis.get(phone_key)
    if phone_count and int(phone_count) >= 1:
        raise HTTPException(429, "请等待 1 分钟后再次获取验证码")

    ip_count = await rc.redis.get(ip_key)
    if ip_count and int(ip_count) >= 10:
        raise HTTPException(429, "请求过于频繁，请稍后再试")


@router.post("/send-otp")
async def send_otp(body: CustomerSendOTP, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await _check_otp_rate(body.phone, client_ip)

    code = str(secrets.randbelow(900000) + 100000)
    await rc.redis.setex(_otp_key(body.phone), _OTP_TTL, code)

    # Rate-limit counters
    async with rc.redis.pipeline(transaction=False) as pipe:
        await pipe.incr(_OTP_SEND_PREFIX + body.phone)
        await pipe.expire(_OTP_SEND_PREFIX + body.phone, 60)
        await pipe.incr(_OTP_IP_PREFIX + client_ip)
        await pipe.expire(_OTP_IP_PREFIX + client_ip, 300)
        await pipe.execute()

    logger.info("OTP sent: phone=***%s", body.phone[-4:])

    # In production, call SMS gateway here.
    # Only expose the code in DEMO_MODE.
    resp: dict = {"ok": True}
    if _DEMO_MODE:
        resp["demo_code"] = code
    return resp


@router.post("/verify-otp")
async def verify_otp(body: CustomerVerifyOTP, db: AsyncSession = Depends(get_db)):
    # Brute-force protection: max 5 attempts per OTP before it's invalidated
    verify_key = _OTP_VERIFY_PREFIX + body.phone
    attempts = await rc.redis.get(verify_key)
    if attempts and int(attempts) >= 5:
        await rc.redis.delete(_otp_key(body.phone))
        await rc.redis.delete(verify_key)
        raise HTTPException(429, "验证次数过多，请重新获取验证码")

    stored = await rc.redis.get(_otp_key(body.phone))
    if not stored or stored != body.code:
        async with rc.redis.pipeline(transaction=False) as pipe:
            await pipe.incr(verify_key)
            await pipe.expire(verify_key, _OTP_TTL)
            await pipe.execute()
        raise HTTPException(400, "验证码无效或已过期")

    await rc.redis.delete(_otp_key(body.phone))
    await rc.redis.delete(verify_key)

    result = await db.execute(select(Customer).where(Customer.phone == body.phone))
    customer = result.scalar_one_or_none()
    if not customer:
        customer = Customer(id=str(uuid.uuid4()), phone=body.phone)
        db.add(customer)
        await db.commit()
        await db.refresh(customer)
        logger.info("Customer created: id=%s", customer.id)

    token = _create_customer_token(customer.id, customer.phone)
    return {"token": token, "customer": CustomerOut.model_validate(customer)}


@router.get("/me/orders", response_model=list[OrderOut])
async def my_orders(
    limit: int = 20,
    credentials: HTTPAuthorizationCredentials = Depends(_customer_bearer),
    db: AsyncSession = Depends(get_db),
):
    """Customer views their own order history across devices. Requires Bearer token."""
    payload = verify_customer_token(credentials.credentials)
    customer_id = payload["sub"]
    result = await db.execute(
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.id.desc())
        .limit(limit)
    )
    return result.scalars().all()
