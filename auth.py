import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "change-this-before-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.getenv("ADMIN_TOKEN_TTL_HOURS", "8"))
ADMIN_USER = os.getenv("ADMIN_USER", "admin")

_pass_hash: bytes | None = None
_bearer = HTTPBearer()


def _get_pass_hash() -> bytes:
    global _pass_hash
    if _pass_hash is None:
        stored = os.getenv("ADMIN_PASS_HASH", "")
        if stored:
            _pass_hash = stored.encode()
        else:
            plain = os.getenv("ADMIN_PASS", "admin2024")
            _pass_hash = bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12))
    return _pass_hash


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def check_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_admin_token(username: str = "admin", role: str = "super_admin", merchant_id: Optional[int] = None) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload: dict = {"sub": username, "role": role, "exp": exp}
    if merchant_id is not None:
        payload["merchant_id"] = merchant_id
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def check_credentials(username: str, password: str) -> bool:
    if not secrets.compare_digest(username.encode(), ADMIN_USER.encode()):
        return False
    try:
        return bcrypt.checkpw(password.encode(), _get_pass_hash())
    except Exception:
        return False


def _decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role = payload.get("role", "")
        if role not in ("super_admin", "merchant_admin"):
            raise ValueError("not an admin token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired", headers={"WWW-Authenticate": "Bearer"})
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"})


def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Allows both super_admin and merchant_admin."""
    return _decode_token(credentials.credentials)


_bearer_optional = HTTPBearer(auto_error=False)


def verify_admin_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional),
) -> Optional[dict]:
    """Like verify_admin but returns None instead of 401 when no token is present."""
    if credentials is None:
        return None
    try:
        return _decode_token(credentials.credentials)
    except HTTPException:
        return None


def verify_super_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Allows only super_admin."""
    payload = _decode_token(credentials.credentials)
    if payload.get("role") != "super_admin":
        raise HTTPException(403, "Super admin required")
    return payload


# ── Multi-tenant scope helpers ────────────────────────────────────────────────

def require_merchant_scope(admin: dict, resource_merchant_id: int) -> None:
    """Raises 403 if a merchant_admin tries to access another merchant's resource."""
    if admin.get("role") == "super_admin":
        return
    if admin.get("merchant_id") != resource_merchant_id:
        raise HTTPException(403, "无权访问其他商家的资源")


def scoped_merchant_id(admin: dict) -> Optional[int]:
    """Returns merchant_id for merchant_admin (list filter), None for super_admin (no filter)."""
    if admin.get("role") == "super_admin":
        return None
    return admin.get("merchant_id")

