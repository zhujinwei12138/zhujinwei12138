import logging
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from audit import record as audit_record
from auth import require_merchant_scope, verify_admin, verify_admin_optional, verify_super_admin
from database import get_db
from models import Merchant
from schemas import MerchantIn, MerchantOut


class MerchantPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = None
    address: Optional[str] = None
    table_count: Optional[int] = Field(None, ge=1, le=500)
    status: Optional[Literal["active", "inactive"]] = None

router = APIRouter(prefix="/api/merchants", tags=["merchants"])
logger = logging.getLogger(__name__)


@router.get("/{merchant_id}", response_model=MerchantOut)
async def get_merchant_public(merchant_id: int, db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns merchant info without auth (needed by customer page)."""
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    return merchant


@router.get("", response_model=list[MerchantOut])
async def list_merchants(
    skip: int = Query(0, ge=0, le=100_000),
    limit: int = Query(200, ge=1, le=1000),
    admin: Optional[dict] = Depends(verify_admin_optional),
    db: AsyncSession = Depends(get_db),
):
    """Public (unauthenticated): returns active merchants only.
    Authenticated admin: super_admin gets all, merchant_admin gets own."""
    if admin is None:
        result = await db.execute(
            select(Merchant).where(Merchant.status == "active").order_by(Merchant.created_at)
        )
        return result.scalars().all()

    if admin.get("role") == "super_admin":
        result = await db.execute(
            select(Merchant).order_by(Merchant.created_at).offset(skip).limit(limit)
        )
        return result.scalars().all()

    mid = admin.get("merchant_id")
    if not mid:
        return []
    merchant = await db.get(Merchant, mid)
    return [merchant] if merchant else []


@router.post("", response_model=MerchantOut)
async def create_merchant(
    body: MerchantIn,
    request: Request,
    admin: dict = Depends(verify_super_admin),  # only super_admin
    db: AsyncSession = Depends(get_db),
):
    merchant = Merchant(**body.model_dump())
    db.add(merchant)
    await db.flush()
    await audit_record(
        db, actor=admin["sub"], action="CREATE", resource="merchants",
        resource_id=str(merchant.id), detail={"name": merchant.name},
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(merchant)
    return merchant


@router.put("/{merchant_id}", response_model=MerchantOut)
async def update_merchant(
    merchant_id: int,
    body: MerchantIn,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """super_admin: any merchant. merchant_admin: only their own."""
    require_merchant_scope(admin, merchant_id)
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    changes = body.model_dump(exclude_none=True)
    for k, v in changes.items():
        setattr(merchant, k, v)
    await audit_record(
        db, actor=admin["sub"], action="UPDATE", resource="merchants",
        resource_id=str(merchant_id), detail=changes,
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(merchant)
    return merchant


@router.patch("/{merchant_id}", response_model=MerchantOut)
async def patch_merchant(
    merchant_id: int,
    body: MerchantPatch,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Partial update — only provided fields are changed."""
    require_merchant_scope(admin, merchant_id)
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    changes = body.model_dump(exclude_none=True)
    for k, v in changes.items():
        setattr(merchant, k, v)
    await audit_record(
        db, actor=admin["sub"], action="UPDATE", resource="merchants",
        resource_id=str(merchant_id), detail=changes,
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(merchant)
    return merchant


@router.delete("/{merchant_id}")
async def delete_merchant(
    merchant_id: int,
    request: Request,
    admin: dict = Depends(verify_super_admin),  # only super_admin
    db: AsyncSession = Depends(get_db),
):
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    await audit_record(
        db, actor=admin["sub"], action="DELETE", resource="merchants",
        resource_id=str(merchant_id), detail={"name": merchant.name},
        ip=request.client.host if request.client else None,
    )
    await db.delete(merchant)
    await db.commit()
    return {"ok": True}
