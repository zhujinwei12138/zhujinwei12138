import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import check_credentials, check_password, create_admin_token, verify_super_admin
from database import get_db
from models import AdminUser
from schemas import AdminUserIn, AdminUserOut
import redis_client as rc
from auth import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)

_FAIL_PREFIX = "login_fail:"
_MAX_FAILURES = 10
_LOCKOUT_TTL = 5 * 60  # 5 minutes


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginIn, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = _FAIL_PREFIX + client_ip

    fail_count = await rc.redis.get(rate_key)
    if fail_count and int(fail_count) >= _MAX_FAILURES:
        raise HTTPException(429, "登录尝试过多，请 5 分钟后再试")

    token = None

    # 1. Check database admin users first
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == body.username, AdminUser.is_active == True)
    )
    db_user = result.scalar_one_or_none()
    if db_user and check_password(body.password, db_user.password_hash):
        token = create_admin_token(
            username=db_user.username,
            role=db_user.role,
            merchant_id=db_user.merchant_id,
        )

    # 2. Fall back to env-based super admin
    if token is None and check_credentials(body.username, body.password):
        token = create_admin_token(username=body.username, role="super_admin")

    if token is None:
        async with rc.redis.pipeline(transaction=False) as pipe:
            await pipe.incr(rate_key)
            await pipe.expire(rate_key, _LOCKOUT_TTL)
            await pipe.execute()
        logger.warning("Login failed ip=%s user=%s", client_ip, body.username)
        raise HTTPException(401, "用户名或密码错误")

    await rc.redis.delete(rate_key)
    logger.info("Login success ip=%s user=%s", client_ip, body.username)
    return {"token": token, "type": "bearer"}


# ── Admin user management (super_admin only) ─────────────────
@router.get("/users", response_model=list[AdminUserOut], dependencies=[Depends(verify_super_admin)])
async def list_admin_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AdminUser).order_by(AdminUser.id))
    return result.scalars().all()


@router.post("/users", response_model=AdminUserOut, dependencies=[Depends(verify_super_admin)])
async def create_admin_user(body: AdminUserIn, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(AdminUser).where(AdminUser.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "用户名已存在")
    user = AdminUser(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
        merchant_id=body.merchant_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("AdminUser created: username=%s role=%s", user.username, user.role)
    return user


@router.put("/users/{user_id}", response_model=AdminUserOut, dependencies=[Depends(verify_super_admin)])
async def update_admin_user(user_id: int, body: AdminUserIn, db: AsyncSession = Depends(get_db)):
    user = await db.get(AdminUser, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.username = body.username
    user.password_hash = hash_password(body.password)
    user.role = body.role
    user.merchant_id = body.merchant_id
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", dependencies=[Depends(verify_super_admin)])
async def delete_admin_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(AdminUser, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    await db.delete(user)
    await db.commit()
    logger.info("AdminUser deleted: id=%s", user_id)
    return {"ok": True}
