import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from audit import record as audit_record
from auth import (
    check_credentials, check_password, create_admin_token,
    hash_password, verify_admin, verify_super_admin,
)
from database import get_db
from models import AdminUser, AuditLog
from schemas import AdminUserIn, AdminUserOut
import redis_client as rc

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)

_FAIL_PREFIX = "login_fail:"
_MAX_FAILURES = 10
_LOCKOUT_TTL = 5 * 60


class LoginIn(BaseModel):
    username: str
    password: str


class PasswordChangeIn(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=100)


@router.post("/login")
async def login(body: LoginIn, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = _FAIL_PREFIX + client_ip

    fail_count = await rc.redis.get(rate_key)
    if fail_count and int(fail_count) >= _MAX_FAILURES:
        raise HTTPException(429, "登录尝试过多，请 5 分钟后再试")

    token = None
    role = "super_admin"
    merchant_id = None

    # 1. Check DB admin users first
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
        role = db_user.role

    # 2. Fallback to env-based super admin
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
    logger.info("Login success ip=%s user=%s role=%s", client_ip, body.username, role)
    return {"token": token, "type": "bearer"}


# ── Admin user management ─────────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserOut], dependencies=[Depends(verify_super_admin)])
async def list_admin_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AdminUser).order_by(AdminUser.id))
    return result.scalars().all()


@router.post("/users", response_model=AdminUserOut)
async def create_admin_user(
    body: AdminUserIn,
    request: Request,
    admin: dict = Depends(verify_super_admin),
    db: AsyncSession = Depends(get_db),
):
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
    await db.flush()
    await audit_record(db, actor=admin["sub"], action="CREATE", resource="admin_users",
                       resource_id=str(user.id), detail={"username": user.username, "role": user.role},
                       ip=request.client.host if request.client else None)
    await db.commit()
    await db.refresh(user)
    logger.info("AdminUser created: username=%s role=%s by=%s", user.username, user.role, admin["sub"])
    return user


@router.put("/users/{user_id}", response_model=AdminUserOut)
async def update_admin_user(
    user_id: int,
    body: AdminUserIn,
    request: Request,
    admin: dict = Depends(verify_super_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(AdminUser, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.username = body.username
    user.password_hash = hash_password(body.password)
    user.role = body.role
    user.merchant_id = body.merchant_id
    await audit_record(db, actor=admin["sub"], action="UPDATE", resource="admin_users",
                       resource_id=str(user_id), ip=request.client.host if request.client else None)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/users/{user_id}/password")
async def change_admin_password(
    user_id: int,
    body: PasswordChangeIn,
    request: Request,
    admin: dict = Depends(verify_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Change a specific admin user's password without affecting other fields."""
    user = await db.get(AdminUser, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.password_hash = hash_password(body.new_password)
    await audit_record(db, actor=admin["sub"], action="CHANGE_PASSWORD", resource="admin_users",
                       resource_id=str(user_id), ip=request.client.host if request.client else None)
    await db.commit()
    logger.info("AdminUser password changed: id=%s by=%s", user_id, admin["sub"])
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_admin_user(
    user_id: int,
    request: Request,
    admin: dict = Depends(verify_super_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(AdminUser, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    await audit_record(db, actor=admin["sub"], action="DELETE", resource="admin_users",
                       resource_id=str(user_id), detail={"username": user.username},
                       ip=request.client.host if request.client else None)
    await db.delete(user)
    await db.commit()
    logger.info("AdminUser deleted: id=%s by=%s", user_id, admin["sub"])
    return {"ok": True}


# ── Self-service password change (merchant_admin can change own password) ─────

class SelfPasswordIn(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=100)
    new_password: str = Field(..., min_length=6, max_length=100)


@router.put("/me/password")
async def change_own_password(
    body: SelfPasswordIn,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """merchant_admin（或 super_admin）修改自己的密码，需提供旧密码验证。"""
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == admin["sub"], AdminUser.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "账号不存在或已停用")
    if not check_password(body.old_password, user.password_hash):
        raise HTTPException(400, "旧密码错误")
    user.password_hash = hash_password(body.new_password)
    await audit_record(
        db, actor=admin["sub"], action="CHANGE_PASSWORD", resource="admin_users",
        resource_id=str(user.id), ip=request.client.host if request.client else None,
    )
    await db.commit()
    logger.info("AdminUser changed own password: username=%s", admin["sub"])
    return {"ok": True}


# ── Audit log viewer ──────────────────────────────────────────────────────────

@router.get("/audit-logs")
async def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """super_admin: all logs. merchant_admin: only their own actions."""
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    if admin.get("role") != "super_admin":
        stmt = stmt.where(AuditLog.actor == admin["sub"])
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": r.id, "actor": r.actor, "action": r.action,
            "resource": r.resource, "resource_id": r.resource_id,
            "detail": r.detail, "ip": r.ip,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
