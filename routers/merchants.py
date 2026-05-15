import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from audit import record as audit_record
from auth import verify_admin
from database import get_db
from models import Merchant
from schemas import MerchantIn, MerchantOut

router = APIRouter(prefix="/api/merchants", tags=["merchants"])
logger = logging.getLogger(__name__)


@router.get("/{merchant_id}", response_model=MerchantOut)
async def get_merchant_public(merchant_id: int, db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns merchant info without auth (needed by customer page)."""
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    return merchant


@router.get("", response_model=list[MerchantOut], dependencies=[Depends(verify_admin)])
async def list_merchants(skip: int = 0, limit: int = 200, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Merchant).order_by(Merchant.created_at).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=MerchantOut)
async def create_merchant(
    body: MerchantIn,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    merchant = Merchant(**body.model_dump())
    db.add(merchant)
    await db.flush()
    await audit_record(db, actor=admin["sub"], action="CREATE", resource="merchants",
                       resource_id=str(merchant.id), detail={"name": merchant.name},
                       ip=request.client.host if request.client else None)
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
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(merchant, k, v)
    await audit_record(db, actor=admin["sub"], action="UPDATE", resource="merchants",
                       resource_id=str(merchant_id), ip=request.client.host if request.client else None)
    await db.commit()
    await db.refresh(merchant)
    return merchant


@router.delete("/{merchant_id}")
async def delete_merchant(
    merchant_id: int,
    request: Request,
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    await audit_record(db, actor=admin["sub"], action="DELETE", resource="merchants",
                       resource_id=str(merchant_id), detail={"name": merchant.name},
                       ip=request.client.host if request.client else None)
    await db.delete(merchant)
    await db.commit()
    return {"ok": True}
