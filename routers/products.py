import json
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Product
from schemas import ProductOut
import redis_client as rc

router = APIRouter(prefix="/api/products", tags=["products"])

CACHE_TTL = 300  # 5 minutes


@router.get("", response_model=list[ProductOut])
async def list_products(category: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    cache_key = f"products:{category or 'all'}"
    cached = await rc.redis.get(cache_key)
    if cached:
        return json.loads(cached)

    stmt = select(Product)
    if category and category != "全部":
        stmt = stmt.where(Product.category == category)
    result = await db.execute(stmt)
    products = result.scalars().all()
    data = [ProductOut.model_validate(p).model_dump(mode="json") for p in products]

    await rc.redis.setex(cache_key, CACHE_TTL, json.dumps(data, default=str))
    return data
