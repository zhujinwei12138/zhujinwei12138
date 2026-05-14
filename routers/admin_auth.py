import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import check_credentials, create_admin_token
import redis_client as rc

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)

_FAIL_PREFIX = "login_fail:"
_MAX_FAILURES = 10
_LOCKOUT_TTL = 5 * 60  # 5 minutes


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginIn, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = _FAIL_PREFIX + client_ip

    fail_count = await rc.redis.get(rate_key)
    if fail_count and int(fail_count) >= _MAX_FAILURES:
        raise HTTPException(429, "登录尝试过多，请 5 分钟后再试")

    if not check_credentials(body.username, body.password):
        async with rc.redis.pipeline(transaction=False) as pipe:
            await pipe.incr(rate_key)
            await pipe.expire(rate_key, _LOCKOUT_TTL)
            await pipe.execute()
        logger.warning("Login failed ip=%s", client_ip)
        raise HTTPException(401, "用户名或密码错误")

    await rc.redis.delete(rate_key)
    logger.info("Login success ip=%s", client_ip)
    return {"token": create_admin_token(), "type": "bearer"}
