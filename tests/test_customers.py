import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_send_otp_success(async_client: AsyncClient):
    res = await async_client.post("/api/customers/send-otp", json={"phone": "13800138000"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    # DEMO_MODE=true so demo_code should be present
    assert "demo_code" in data
    assert len(data["demo_code"]) == 6


@pytest.mark.asyncio
async def test_send_otp_invalid_phone(async_client: AsyncClient):
    res = await async_client.post("/api/customers/send-otp", json={"phone": "123"})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_verify_otp_wrong_code(async_client: AsyncClient):
    # First send OTP
    phone = "13900139001"
    await async_client.post("/api/customers/send-otp", json={"phone": phone})
    # Verify with wrong code
    res = await async_client.post("/api/customers/verify-otp", json={"phone": phone, "code": "000000"})
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_verify_otp_success_and_my_orders(async_client: AsyncClient):
    phone = "13700137000"
    # Send OTP
    send_res = await async_client.post("/api/customers/send-otp", json={"phone": phone})
    assert send_res.status_code == 200
    code = send_res.json()["demo_code"]

    # Verify OTP — should create customer and return token
    verify_res = await async_client.post("/api/customers/verify-otp", json={"phone": phone, "code": code})
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert "token" in data
    assert data["customer"]["phone"] == phone

    # Use token to query orders (should be empty for new customer)
    token = data["token"]
    orders_res = await async_client.get(
        "/api/customers/me/orders",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert orders_res.status_code == 200
    assert isinstance(orders_res.json(), list)


@pytest.mark.asyncio
async def test_my_orders_no_token(async_client: AsyncClient):
    res = await async_client.get("/api/customers/me/orders")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_my_orders_invalid_token(async_client: AsyncClient):
    res = await async_client.get(
        "/api/customers/me/orders",
        headers={"Authorization": "Bearer invalid.token.here"}
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_verify_otp_idempotent(async_client: AsyncClient):
    """Second verification with same phone should return same customer."""
    phone = "13600136000"
    send_res = await async_client.post("/api/customers/send-otp", json={"phone": phone})
    code = send_res.json()["demo_code"]
    res1 = await async_client.post("/api/customers/verify-otp", json={"phone": phone, "code": code})
    customer_id_1 = res1.json()["customer"]["id"]

    # Send a new OTP and verify again
    send_res2 = await async_client.post("/api/customers/send-otp", json={"phone": phone})
    code2 = send_res2.json()["demo_code"]
    res2 = await async_client.post("/api/customers/verify-otp", json={"phone": phone, "code": code2})
    customer_id_2 = res2.json()["customer"]["id"]

    assert customer_id_1 == customer_id_2  # same customer
