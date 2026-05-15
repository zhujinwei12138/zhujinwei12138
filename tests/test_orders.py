import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_order(async_client: AsyncClient, admin_headers: dict):
    # Ensure a product exists before ordering
    product_res = await async_client.post("/api/products", json={
        "name": "测试精酿", "description": "", "volume": "330ml",
        "alcohol": "5%", "price": 38.0, "category": "精酿", "stock": 100,
    }, headers=admin_headers)
    assert product_res.status_code == 200
    pid = product_res.json()["id"]

    merchant_res = await async_client.post("/api/merchants", json={
        "name": "测试商家", "table_count": 10
    }, headers=admin_headers)
    assert merchant_res.status_code == 200
    mid = merchant_res.json()["id"]

    res = await async_client.post("/api/orders", json={
        "merchant_id": mid,
        "table_no": "5",
        "items": [{"id": pid, "name": "测试精酿", "price": 38.0, "quantity": 2}],
        "total": 76.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "pending_payment"
    assert data["total"] == 76.0


@pytest.mark.asyncio
async def test_create_order_invalid_total(async_client: AsyncClient):
    res = await async_client.post("/api/orders", json={
        "merchant_id": 1,
        "table_no": "5",
        "items": [{"id": 1, "name": "精酿IPA", "price": 38.0, "quantity": 1}],
        "total": -1.0
    })
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_order_empty_items(async_client: AsyncClient):
    res = await async_client.post("/api/orders", json={
        "merchant_id": 1,
        "table_no": "5",
        "items": [],
        "total": 0.0
    })
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_list_orders_requires_auth(async_client: AsyncClient):
    res = await async_client.get("/api/orders")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_invalid_status_transition(async_client: AsyncClient):
    login = await async_client.post("/api/admin/login", json={"username": "admin", "password": "testpass"})
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    # Try invalid status string
    res = await async_client.put("/api/orders/999/status", json={"status": "invalid_status"}, headers=headers)
    assert res.status_code == 422
