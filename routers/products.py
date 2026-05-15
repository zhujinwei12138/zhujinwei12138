import json
import logging
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from audit import record as audit_record
from auth import verify_admin
from database import get_db
from models import Product
from schemas import ProductIn, ProductOut
import redis_client as rc

router = APIRouter(prefix="/api/products", tags=["products"])
logger = logging.getLogger(__name__)

CACHE_TTL = 300
_CACHE_PATTERN = "products:*"
_MAX_SIZE = 5 * 1024 * 1024  # 5 MB
_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "uploads")

# Allowed MIME types → canonical extension
_ALLOWED_MIME: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _verify_image_magic(data: bytes) -> bool:
    """Check file magic bytes — never trust Content-Type alone."""
    if data[:3] == b"\xff\xd8\xff":
        return True  # JPEG
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return True  # PNG
    if data[:4] == b"RIFF" and len(data) >= 12 and data[8:12] == b"WEBP":
        return True  # WebP
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return True  # GIF
    return False


async def _invalidate_product_cache() -> None:
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


@router.post("", response_model=ProductOut)
async def create_product(
    body: ProductIn,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    product = Product(**body.model_dump())
    db.add(product)
    await db.flush()
    await audit_record(db, actor=admin["sub"], action="CREATE", resource="products",
                       resource_id=str(product.id), detail={"name": product.name},
                       ip=request.client.host if request.client else None)
    await db.commit()
    await db.refresh(product)
    await _invalidate_product_cache()
    logger.info("Product created: id=%s name=%s", product.id, product.name)
    return product


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    body: ProductIn,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    for k, v in body.model_dump().items():
        setattr(product, k, v)
    await audit_record(db, actor=admin["sub"], action="UPDATE", resource="products",
                       resource_id=str(product_id), ip=request.client.host if request.client else None)
    await db.commit()
    await db.refresh(product)
    await _invalidate_product_cache()
    logger.info("Product updated: id=%s", product_id)
    return product


@router.post("/{product_id}/image", response_model=ProductOut)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    content_type = file.content_type or ""
    if content_type not in _ALLOWED_MIME:
        raise HTTPException(400, "仅支持 JPEG / PNG / WebP / GIF 格式")

    content = await file.read()
    if len(content) > _MAX_SIZE:
        raise HTTPException(400, "图片大小不能超过 5 MB")

    if not _verify_image_magic(content):
        raise HTTPException(400, "文件内容与声明的格式不符")

    os.makedirs(_UPLOAD_DIR, exist_ok=True)

    # Use UUID filename — never trust user-supplied filename
    ext = _ALLOWED_MIME[content_type]
    filename = f"product_{product_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(_UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    # Remove old image file if it's a local upload
    if product.image_url and product.image_url.startswith("/uploads/"):
        old_path = os.path.join(_UPLOAD_DIR, os.path.basename(product.image_url))
        if os.path.isfile(old_path):
            os.remove(old_path)

    product.image_url = f"/uploads/{filename}"
    await db.commit()
    await db.refresh(product)
    await _invalidate_product_cache()
    logger.info("Product image uploaded: id=%s", product_id)
    return product


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    await audit_record(db, actor=admin["sub"], action="DELETE", resource="products",
                       resource_id=str(product_id), detail={"name": product.name},
                       ip=request.client.host if request.client else None)
    await db.delete(product)
    await db.commit()
    await _invalidate_product_cache()
    logger.info("Product deleted: id=%s", product_id)
    return {"ok": True}
