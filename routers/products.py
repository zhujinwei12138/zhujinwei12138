import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import verify_admin
from database import get_db
from models import Product
from schemas import ProductIn, ProductOut
import redis_client as rc

router = APIRouter(prefix="/api/products", tags=["products"])
logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 minutes
_CACHE_PATTERN = "products:*"


async def _invalidate_product_cache() -> None:
    """清除所有商品缓存键。"""
    keys = await rc.redis.keys(_CACHE_PATTERN)
    if keys:
        await rc.redis.delete(*keys)


@router.get("", response_model=list[ProductOut])
async def list_products(category: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    cache_key = f"products:{category or 'all'}"
    cached = await rc.redis.get(cache_key)
    if cached:
        return json.loads(cached)

    stmt = select(Product).order_by(Product.id)
    if category and category != "全部":
        stmt = stmt.where(Product.category == category)
    result = await db.execute(stmt)
    products = result.scalars().all()
    data = [ProductOut.model_validate(p).model_dump(mode="json") for p in products]

    await rc.redis.setex(cache_key, CACHE_TTL, json.dumps(data, default=str))
    return data


@router.post("", response_model=ProductOut, dependencies=[Depends(verify_admin)])
async def create_product(body: ProductIn, db: AsyncSession = Depends(get_db)):
    product = Product(**body.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await _invalidate_product_cache()
    logger.info("Product created: id=%s name=%s", product.id, product.name)
    return product


@router.put("/{product_id}", response_model=ProductOut, dependencies=[Depends(verify_admin)])
async def update_product(product_id: int, body: ProductIn, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    for k, v in body.model_dump().items():
        setattr(product, k, v)
    await db.commit()
    await db.refresh(product)
    await _invalidate_product_cache()
    logger.info("Product updated: id=%s", product_id)
    return product


@router.delete("/{product_id}", dependencies=[Depends(verify_admin)])
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    await db.delete(product)
    await db.commit()
    await _invalidate_product_cache()
    logger.info("Product deleted: id=%s", product_id)
    return {"ok": True}
