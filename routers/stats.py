from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Merchant, Order, Payment
from schemas import MerchantStats, SummaryStats

router = APIRouter(prefix="/api/stats", tags=["stats"])

PAID_STATUSES = ("paid", "preparing", "completed")


@router.get("", response_model=list[MerchantStats])
async def merchant_stats(db: AsyncSession = Depends(get_db)):
    merchants = (await db.execute(select(Merchant))).scalars().all()
    orders = (await db.execute(select(Order))).scalars().all()

    result = []
    for m in merchants:
        paid_orders = [o for o in orders if o.merchant_id == m.id and o.status in PAID_STATUSES]
        total_qty = sum(
            sum(item["quantity"] for item in o.items) for o in paid_orders
        )
        total_rev = sum(float(o.total) for o in paid_orders)
        result.append(MerchantStats(
            id=m.id,
            name=m.name,
            status=m.status,
            order_count=len(paid_orders),
            total_quantity=total_qty,
            total_revenue=total_rev,
        ))
    return result


@router.get("/summary", response_model=SummaryStats)
async def summary_stats(db: AsyncSession = Depends(get_db)):
    orders = (await db.execute(select(Order))).scalars().all()
    payments = (await db.execute(select(Payment))).scalars().all()
    merchants = (await db.execute(select(Merchant))).scalars().all()

    today = date.today()
    paid_payments = [p for p in payments if p.status == "paid"]
    refunded_payments = [p for p in payments if p.status == "refunded"]

    return SummaryStats(
        total_orders=len(orders),
        paid_orders=sum(1 for o in orders if o.status in PAID_STATUSES),
        pending_orders=sum(1 for o in orders if o.status == "pending_payment"),
        total_revenue=sum(float(p.amount) for p in paid_payments),
        refund_amount=sum(float(p.amount) for p in refunded_payments),
        merchant_count=sum(1 for m in merchants if m.status == "active"),
        today_orders=sum(
            1 for o in orders
            if o.created_at and o.created_at.date() == today
        ),
        wechat_revenue=sum(float(p.amount) for p in paid_payments if p.method == "wechat"),
        alipay_revenue=sum(float(p.amount) for p in paid_payments if p.method == "alipay"),
    )
