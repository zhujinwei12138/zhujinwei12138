from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import verify_admin
from database import get_db
from models import Merchant
from schemas import MerchantIn, MerchantOut

router = APIRouter(prefix="/api/merchants", tags=["merchants"])


@router.get("", response_model=list[MerchantOut], dependencies=[Depends(verify_admin)])
async def list_merchants(skip: int = 0, limit: int = 200, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Merchant).order_by(Merchant.created_at).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=MerchantOut, dependencies=[Depends(verify_admin)])
async def create_merchant(body: MerchantIn, db: AsyncSession = Depends(get_db)):
    merchant = Merchant(**body.model_dump())
    db.add(merchant)
    await db.commit()
    await db.refresh(merchant)
    return merchant


@router.put("/{merchant_id}", response_model=MerchantOut, dependencies=[Depends(verify_admin)])
async def update_merchant(merchant_id: int, body: MerchantIn, db: AsyncSession = Depends(get_db)):
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(merchant, k, v)
    await db.commit()
    await db.refresh(merchant)
    return merchant


@router.delete("/{merchant_id}", dependencies=[Depends(verify_admin)])
async def delete_merchant(merchant_id: int, db: AsyncSession = Depends(get_db)):
    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(404, "Merchant not found")
    await db.delete(merchant)
    await db.commit()
    return {"ok": True}
