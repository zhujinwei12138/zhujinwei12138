"""JWT-based admin authentication utilities."""
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "change-this-before-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.getenv("ADMIN_TOKEN_TTL_HOURS", "8"))

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin2024")

_bearer = HTTPBearer()


def create_admin_token() -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": "admin", "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def check_credentials(username: str, password: str) -> bool:
    return (
        secrets.compare_digest(username, ADMIN_USER)
        and secrets.compare_digest(password, ADMIN_PASS)
    )


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
