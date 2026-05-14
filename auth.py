import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "change-this-before-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.getenv("ADMIN_TOKEN_TTL_HOURS", "8"))
ADMIN_USER = os.getenv("ADMIN_USER", "admin")

# Cached bcrypt hash — computed once at first login attempt
_pass_hash: bytes | None = None

_bearer = HTTPBearer()


def _get_pass_hash() -> bytes:
    """Return bcrypt hash, preferring ADMIN_PASS_HASH over plaintext ADMIN_PASS."""
    global _pass_hash
    if _pass_hash is None:
        stored = os.getenv("ADMIN_PASS_HASH", "")
        if stored:
            _pass_hash = stored.encode()
        else:
            plain = os.getenv("ADMIN_PASS", "admin2024")
            _pass_hash = bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12))
    return _pass_hash


def create_admin_token() -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": "admin", "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def check_credentials(username: str, password: str) -> bool:
    if not secrets.compare_digest(username.encode(), ADMIN_USER.encode()):
        return False
    try:
        return bcrypt.checkpw(password.encode(), _get_pass_hash())
    except Exception:
        return False


def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """FastAPI dependency — raises 401 if token is missing, invalid, or expired."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") != "admin":
            raise ValueError("bad sub")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired", headers={"WWW-Authenticate": "Bearer"})
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"})
