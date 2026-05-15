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


@pytest.mark.asyncio
async def test_mock_pay_disabled_in_live_mode(async_client: AsyncClient, monkeypatch):
    """mock-pay returns 404 when PAYMENT_MODE != mock."""
    import routers.payments as pm
    monkeypatch.setattr(pm, "PAYMENT_MODE", "live")
    res = await async_client.post("/api/payments/ANYID/mock-pay")
    assert res.status_code == 404
    monkeypatch.setattr(pm, "PAYMENT_MODE", "mock")


@pytest.mark.asyncio
async def test_mock_pay_nonexistent(async_client: AsyncClient):
    res = await async_client.post("/api/payments/NONEXISTENT/mock-pay")
    # In mock mode, should be 404 (payment not found)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_audit_log_accessible_to_admin(async_client: AsyncClient, admin_headers: dict):
    res = await async_client.get("/api/admin/audit-logs", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
