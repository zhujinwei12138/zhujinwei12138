import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Customer, Order
from schemas import CustomerOut, CustomerSendOTP, CustomerVerifyOTP, OrderOut
import redis_client as rc

router = APIRouter(prefix="/api/customers", tags=["customers"])
logger = logging.getLogger(__name__)

_OTP_TTL = 300  # 5 minutes
_TOKEN_TTL_HOURS = 72

import os
_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-this-before-production")
_ALGORITHM = "HS256"


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


@router.post("/send-otp")
async def send_otp(body: CustomerSendOTP):
    """Generate a 6-digit OTP and store in Redis (demo: returns code in response)."""
    code = str(secrets.randbelow(900000) + 100000)  # 100000–999999
    await rc.redis.setex(_otp_key(body.phone), _OTP_TTL, code)
    logger.info("OTP sent: phone=%s", body.phone[-4:])
    # In production: call SMS gateway here. For demo, return in response.
    return {"ok": True, "demo_code": code}


@router.post("/verify-otp")
async def verify_otp(body: CustomerVerifyOTP, db: AsyncSession = Depends(get_db)):
    """Verify OTP, create customer if new, return JWT."""
    stored = await rc.redis.get(_otp_key(body.phone))
    if not stored or stored != body.code:
        raise HTTPException(400, "验证码无效或已过期")

    await rc.redis.delete(_otp_key(body.phone))

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
    token: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Customer views their own order history across devices."""
    payload = verify_customer_token(token)
    customer_id = payload["sub"]
    result = await db.execute(
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.id.desc())
        .limit(limit)
    )
    return result.scalars().all()
