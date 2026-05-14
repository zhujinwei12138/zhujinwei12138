import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient):
    res = await async_client.post("/api/admin/login", json={"username": "admin", "password": "testpass"})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(async_client: AsyncClient):
    res = await async_client.post("/api/admin/login", json={"username": "admin", "password": "wrong"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_without_token(async_client: AsyncClient):
    res = await async_client.get("/api/orders")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_protected_endpoint_with_token(async_client: AsyncClient):
    login = await async_client.post("/api/admin/login", json={"username": "admin", "password": "testpass"})
    token = login.json()["token"]
    res = await async_client.get("/api/orders", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
