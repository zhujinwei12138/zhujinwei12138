from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import check_credentials, create_admin_token

router = APIRouter(prefix="/api/admin", tags=["admin"])


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginIn):
    if not check_credentials(body.username, body.password):
        raise HTTPException(401, "用户名或密码错误")
    return {"token": create_admin_token(), "type": "bearer"}
