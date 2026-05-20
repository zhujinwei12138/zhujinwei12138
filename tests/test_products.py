import pytest
from httpx import AsyncClient

_PRODUCT_BODY = {
    "name": "测试精酿IPA",
    "description": "清爽苦香",
    "volume": "330ml",
    "alcohol": "6%",
    "price": 38.0,
    "category": "精酿",
    "badge": "新品",
    "gradient": "linear-gradient(135deg,#1e1e40,#2e2e60)",
    "stock": 100,
}


@pytest.mark.asyncio
async def test_list_products_public(async_client: AsyncClient):
    res = await async_client.get("/api/products")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_create_product_requires_auth(async_client: AsyncClient):
    res = await async_client.post("/api/products", json=_PRODUCT_BODY)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_product_admin(async_client: AsyncClient, admin_headers: dict):
    res = await async_client.post("/api/products", json=_PRODUCT_BODY, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == _PRODUCT_BODY["name"]
    assert data["price"] == _PRODUCT_BODY["price"]
    assert data["stock"] == 100
    assert "id" in data


@pytest.mark.asyncio
async def test_create_product_invalid_price(async_client: AsyncClient, admin_headers: dict):
    body = {**_PRODUCT_BODY, "price": -10.0}
    res = await async_client.post("/api/products", json=body, headers=admin_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_create_product_invalid_category(async_client: AsyncClient, admin_headers: dict):
    body = {**_PRODUCT_BODY, "category": ""}
    res = await async_client.post("/api/products", json=body, headers=admin_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_update_product(async_client: AsyncClient, admin_headers: dict):
    # Create first
    create_res = await async_client.post("/api/products", json=_PRODUCT_BODY, headers=admin_headers)
    product_id = create_res.json()["id"]

    # Update
    updated = {**_PRODUCT_BODY, "name": "更新后的IPA", "price": 42.0}
    res = await async_client.put(f"/api/products/{product_id}", json=updated, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "更新后的IPA"
    assert res.json()["price"] == 42.0


@pytest.mark.asyncio
async def test_update_product_not_found(async_client: AsyncClient, admin_headers: dict):
    res = await async_client.put("/api/products/99999", json=_PRODUCT_BODY, headers=admin_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_delete_product(async_client: AsyncClient, admin_headers: dict):
    create_res = await async_client.post("/api/products", json=_PRODUCT_BODY, headers=admin_headers)
    product_id = create_res.json()["id"]
    res = await async_client.delete(f"/api/products/{product_id}", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["ok"] is True


@pytest.mark.asyncio
async def test_delete_product_requires_auth(async_client: AsyncClient, admin_headers: dict):
    create_res = await async_client.post("/api/products", json=_PRODUCT_BODY, headers=admin_headers)
    product_id = create_res.json()["id"]
    res = await async_client.delete(f"/api/products/{product_id}")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_list_products_by_category(async_client: AsyncClient, admin_headers: dict):
    # Create a 瓶装 product
    body = {**_PRODUCT_BODY, "category": "瓶装"}
    await async_client.post("/api/products", json=body, headers=admin_headers)

    res = await async_client.get("/api/products?category=瓶装")
    assert res.status_code == 200
    products = res.json()
    assert all(p["category"] == "瓶装" for p in products)


@pytest.mark.asyncio
async def test_product_image_url_in_response(async_client: AsyncClient, admin_headers: dict):
    res = await async_client.post("/api/products", json=_PRODUCT_BODY, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "image_url" in data  # field present (may be None)
