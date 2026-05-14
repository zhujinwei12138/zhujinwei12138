import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_payment_invalid_order(async_client: AsyncClient):
    res = await async_client.post("/api/payments/create", json={"order_id": 999999, "method": "wechat"})
    assert res.status_code in (404, 400, 422, 500)


@pytest.mark.asyncio
async def test_create_payment_invalid_method(async_client: AsyncClient):
    res = await async_client.post("/api/payments/create", json={"order_id": 1, "method": "cash"})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_payment_negative_order_id(async_client: AsyncClient):
    res = await async_client.post("/api/payments/create", json={"order_id": -1, "method": "wechat"})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_list_payments_requires_auth(async_client: AsyncClient):
    res = await async_client.get("/api/payments")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_refund_requires_auth(async_client: AsyncClient):
    res = await async_client.post("/api/payments/FAKEID/refund", json={"reason": "test"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_nonexistent_payment(async_client: AsyncClient):
    res = await async_client.get("/api/payments/NONEXISTENT999")
    assert res.status_code == 404
