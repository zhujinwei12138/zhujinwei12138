import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from auth import scoped_merchant_id, verify_admin
from database import get_db
from models import Merchant, Order, Payment
from schemas import MerchantStats, SummaryStats

router = APIRouter(prefix="/api/stats", tags=["stats"])
logger = logging.getLogger(__name__)

PAID_STATUSES = ("paid", "preparing", "completed")


@router.get("", response_model=list[MerchantStats])
async def merchant_stats(
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    mid = scoped_merchant_id(admin)

    stmt = (
        select(
            Merchant.id,
            Merchant.name,
            Merchant.status,
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.total), 0).label("total_revenue"),
        )
        .outerjoin(
            Order,
            (Order.merchant_id == Merchant.id) & Order.status.in_(PAID_STATUSES),
        )
        .group_by(Merchant.id, Merchant.name, Merchant.status)
    )
    if mid is not None:
        stmt = stmt.where(Merchant.id == mid)

    rows = (await db.execute(stmt)).all()

    item_stmt = select(Order.merchant_id, Order.items).where(Order.status.in_(PAID_STATUSES))
    if mid is not None:
        item_stmt = item_stmt.where(Order.merchant_id == mid)
    item_rows = (await db.execute(item_stmt)).all()

    qty_map: dict[int, int] = {}
    for row_mid, items in item_rows:
        qty_map[row_mid] = qty_map.get(row_mid, 0) + sum(item.get("quantity", 0) for item in (items or []))

    return [
        MerchantStats(
            id=r.id,
            name=r.name,
            status=r.status,
            order_count=r.order_count,
            total_quantity=qty_map.get(r.id, 0),
            total_revenue=float(r.total_revenue),
        )
        for r in rows
    ]


@router.get("/summary", response_model=SummaryStats)
async def summary_stats(
    admin: dict = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)
    mid: Optional[int] = scoped_merchant_id(admin)

    order_stmt = select(
        func.count().label("total"),
        func.sum(case((Order.status.in_(PAID_STATUSES), 1), else_=0)).label("paid"),
        func.sum(case((Order.status == "pending_payment", 1), else_=0)).label("pending"),
        func.sum(
            case(
                ((Order.created_at >= today_start) & (Order.created_at < today_end), 1),
                else_=0,
            )
        ).label("today"),
    )
    if mid is not None:
        order_stmt = order_stmt.where(Order.merchant_id == mid)
    order_agg = (await db.execute(order_stmt)).one()

    pay_stmt = select(
        func.coalesce(func.sum(case((Payment.status == "paid", Payment.amount), else_=0)), 0).label("revenue"),
        func.coalesce(func.sum(case((Payment.status == "refunded", Payment.amount), else_=0)), 0).label("refund"),
        func.coalesce(
            func.sum(case(((Payment.status == "paid") & (Payment.method == "wechat"), Payment.amount), else_=0)), 0
        ).label("wechat"),
        func.coalesce(
            func.sum(case(((Payment.status == "paid") & (Payment.method == "alipay"), Payment.amount), else_=0)), 0
        ).label("alipay"),
    )
    if mid is not None:
        pay_stmt = pay_stmt.where(Payment.merchant_id == mid)
    pay_agg = (await db.execute(pay_stmt)).one()

    if mid is not None:
        # merchant_admin: count = 1 (their own) if active, else 0
        merchant = await db.get(Merchant, mid)
        merchant_count = 1 if merchant and merchant.status == "active" else 0
    else:
        merchant_count = (
            await db.execute(select(func.count()).where(Merchant.status == "active"))
        ).scalar_one()

    return SummaryStats(
        total_orders=order_agg.total or 0,
        paid_orders=int(order_agg.paid or 0),
        pending_orders=int(order_agg.pending or 0),
        total_revenue=float(pay_agg.revenue),
        refund_amount=float(pay_agg.refund),
        merchant_count=merchant_count,
        today_orders=int(order_agg.today or 0),
        wechat_revenue=float(pay_agg.wechat),
        alipay_revenue=float(pay_agg.alipay),
    )
