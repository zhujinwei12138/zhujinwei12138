"""
Seed initial data into PostgreSQL on first run.
Reads from the existing JSON files in data/ for convenience.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from database import AsyncSessionLocal
from models import Merchant, Order, Payment, Product


def _load(name: str):
    p = Path(__file__).parent / "data" / name
    if p.exists():
        return json.loads(p.read_text())
    return []


def _parse_dt(s):
    if not s:
        return None
    s = s.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


async def seed_if_empty():
    async with AsyncSessionLocal() as db:
        # Only seed when tables are empty
        if (await db.execute(select(Product))).first():
            return

        # ── Products ──────────────────────────────────────
        for p in _load("products.json"):
            db.add(Product(
                id=p["id"],
                name=p["name"],
                description=p.get("description", ""),
                volume=p.get("volume", ""),
                alcohol=p.get("alcohol", ""),
                price=p["price"],
                category=p["category"],
                badge=p.get("badge") or None,
                gradient=p.get("gradient", ""),
            ))

        # ── Merchants ─────────────────────────────────────
        for m in _load("merchants.json"):
            db.add(Merchant(
                id=m["id"],
                name=m["name"],
                phone=m.get("phone"),
                address=m.get("address"),
                table_count=m.get("tableCount", 10),
                status=m.get("status", "active"),
                created_at=_parse_dt(m.get("createdAt")) or datetime.now(timezone.utc),
            ))

        # ── Orders ────────────────────────────────────────
        for o in _load("orders.json"):
            db.add(Order(
                id=o["id"],
                merchant_id=o["merchantId"],
                table_no=o["tableNo"],
                items=o["items"],
                total=o["total"],
                status=o.get("status", "paid"),
                created_at=_parse_dt(o.get("createdAt")) or datetime.now(timezone.utc),
                paid_at=_parse_dt(o.get("paidAt")),
                preparing_at=_parse_dt(o.get("preparingAt")),
                completed_at=_parse_dt(o.get("completedAt")),
                refunded_at=_parse_dt(o.get("refundedAt")),
                cancelled_at=_parse_dt(o.get("cancelledAt")),
            ))

        # ── Payments ──────────────────────────────────────
        for p in _load("payments.json"):
            db.add(Payment(
                id=p["id"],
                order_id=p["orderId"],
                merchant_id=p["merchantId"],
                amount=p["amount"],
                method=p.get("method", "wechat"),
                status=p.get("status", "paid"),
                created_at=_parse_dt(p.get("createdAt")) or datetime.now(timezone.utc),
                expired_at=_parse_dt(p.get("expiredAt")),
                paid_at=_parse_dt(p.get("paidAt")),
                refunded_at=_parse_dt(p.get("refundedAt")),
                transaction_id=p.get("transactionId"),
                refund_reason=p.get("refundReason"),
            ))

        await db.commit()
        print("✅ Seed data inserted.")
