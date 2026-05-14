import logging
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Merchant, Order, Payment
from schemas import MerchantStats, SummaryStats

router = APIRouter(prefix="/api/stats", tags=["stats"])
logger = logging.getLogger(__name__)

PAID_STATUSES = ("paid", "preparing", "completed")


@router.get("", response_model=list[MerchantStats])
async def merchant_stats(db: AsyncSession = Depends(get_db)):
    # Aggregate order counts and revenue per merchant in SQL
    rows = (await db.execute(
        select(
            Merchant.id,
            Merchant.name,
            Merchant.status,
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.total), 0).label("total_revenue"),
        )
        .outerjoin(
            Order,
            (Order.merchant_id == Merchant.id) & Order.status.in_(PAID_STATUSES)
        )
        .group_by(Merchant.id, Merchant.name, Merchant.status)
    )).all()

    # JSONB items need Python-side aggregation; fetch only minimal columns for paid orders
    item_rows = (await db.execute(
        select(Order.merchant_id, Order.items)
        .where(Order.status.in_(PAID_STATUSES))
    )).all()

    qty_map: dict[int, int] = {}
    for mid, items in item_rows:
        qty_map[mid] = qty_map.get(mid, 0) + sum(item["quantity"] for item in items)

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
async def summary_stats(db: AsyncSession = Depends(get_db)):
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)

    order_agg = (await db.execute(
        select(
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
    )).one()

    pay_agg = (await db.execute(
        select(
            func.coalesce(
                func.sum(case((Payment.status == "paid", Payment.amount), else_=0)), 0
            ).label("revenue"),
            func.coalesce(
                func.sum(case((Payment.status == "refunded", Payment.amount), else_=0)), 0
            ).label("refund"),
            func.coalesce(
                func.sum(
                    case(
                        ((Payment.status == "paid") & (Payment.method == "wechat"), Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("wechat"),
            func.coalesce(
                func.sum(
                    case(
                        ((Payment.status == "paid") & (Payment.method == "alipay"), Payment.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("alipay"),
        )
    )).one()

    merchant_count = (await db.execute(
        select(func.count()).where(Merchant.status == "active")
    )).scalar_one()

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
