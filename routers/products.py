import json
import logging
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from audit import record as audit_record
from auth import require_merchant_scope, scoped_merchant_id, verify_admin
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
async def list_products(
    merchant_id: Optional[int] = Query(None),
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint.
    - merchant_id provided: returns products for that merchant + platform products (merchant_id=NULL)
    - merchant_id omitted: returns only platform products (backward compat)
    """
    cache_key = f"products:{merchant_id or 'global'}:{category or 'all'}"
    cached = await rc.redis.get(cache_key)
    if cached:
        return json.loads(cached)

    if merchant_id is not None:
        # Products belonging to this merchant OR platform products (NULL merchant_id)
        stmt = select(Product).where(
            or_(Product.merchant_id == merchant_id, Product.merchant_id.is_(None))
        )
    else:
        stmt = select(Product).where(Product.merchant_id.is_(None))

    stmt = stmt.order_by(Product.id)
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
    data = body.model_dump()
    # merchant_admin: force merchant_id to their own, ignore body value
    if admin.get("role") == "merchant_admin":
        mid = admin.get("merchant_id")
        if not mid:
            raise HTTPException(403, "此账号未绑定商家，无法创建商品")
        data["merchant_id"] = mid
    # super_admin may leave merchant_id as None (platform product) or set a specific one
    product = Product(**data)
    db.add(product)
    await db.flush()
    await audit_record(
        db, actor=admin["sub"], action="CREATE", resource="products",
        resource_id=str(product.id),
        detail={"name": product.name, "merchant_id": product.merchant_id},
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(product)
    await _invalidate_product_cache()
    logger.info("Product created: id=%s name=%s merchant_id=%s", product.id, product.name, product.merchant_id)
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
    # Platform products (merchant_id=None) can only be edited by super_admin
    if product.merchant_id is None and admin.get("role") != "super_admin":
        raise HTTPException(403, "平台商品只有超级管理员可以修改")
    if product.merchant_id is not None:
        require_merchant_scope(admin, product.merchant_id)

    data = body.model_dump()
    # merchant_admin cannot reassign a product to another merchant
    if admin.get("role") == "merchant_admin":
        data["merchant_id"] = product.merchant_id
    for k, v in data.items():
        setattr(product, k, v)

    await audit_record(
        db, actor=admin["sub"], action="UPDATE", resource="products",
        resource_id=str(product_id),
        ip=request.client.host if request.client else None,
    )
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
    if product.merchant_id is None and admin.get("role") != "super_admin":
        raise HTTPException(403, "平台商品只有超级管理员可以修改")
    if product.merchant_id is not None:
        require_merchant_scope(admin, product.merchant_id)

    content_type = file.content_type or ""
    if content_type not in _ALLOWED_MIME:
        raise HTTPException(400, "仅支持 JPEG / PNG / WebP / GIF 格式")

    content = await file.read()
    if len(content) > _MAX_SIZE:
        raise HTTPException(400, "图片大小不能超过 5 MB")
    if not _verify_image_magic(content):
        raise HTTPException(400, "文件内容与声明的格式不符")

    os.makedirs(_UPLOAD_DIR, exist_ok=True)
    ext = _ALLOWED_MIME[content_type]
    filename = f"product_{product_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(_UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)

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
    if product.merchant_id is None and admin.get("role") != "super_admin":
        raise HTTPException(403, "平台商品只有超级管理员可以删除")
    if product.merchant_id is not None:
        require_merchant_scope(admin, product.merchant_id)

    await audit_record(
        db, actor=admin["sub"], action="DELETE", resource="products",
        resource_id=str(product_id), detail={"name": product.name},
        ip=request.client.host if request.client else None,
    )
    await db.delete(product)
    await db.commit()
    await _invalidate_product_cache()
    logger.info("Product deleted: id=%s", product_id)
    return {"ok": True}
