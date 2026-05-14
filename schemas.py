from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


# ── Product ────────────────────────────────────────────────
class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    volume: str
    alcohol: str
    price: float
    category: str
    badge: Optional[str]
    gradient: str


# ── Merchant ───────────────────────────────────────────────
class MerchantIn(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    table_count: int = 10
    status: str = "active"


class MerchantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    phone: Optional[str]
    address: Optional[str]
    table_count: int
    status: str
    created_at: datetime


# ── Order items ────────────────────────────────────────────
class OrderItem(BaseModel):
    id: int
    name: str
    price: float
    quantity: int


# ── Order ──────────────────────────────────────────────────
class OrderIn(BaseModel):
    merchant_id: int
    table_no: str
    items: list[OrderItem]
    total: float


class OrderStatusIn(BaseModel):
    status: str  # preparing | completed | cancelled


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    merchant_id: int
    table_no: str
    items: Any
    total: float
    status: str
    created_at: datetime
    paid_at: Optional[datetime]
    preparing_at: Optional[datetime]
    completed_at: Optional[datetime]
    refunded_at: Optional[datetime]
    cancelled_at: Optional[datetime]


# ── Payment ────────────────────────────────────────────────
class PaymentCreateIn(BaseModel):
    order_id: int
    method: str = "wechat"


class RefundIn(BaseModel):
    reason: str = "管理员操作退款"


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_id: int
    merchant_id: int
    amount: float
    method: str
    status: str
    created_at: datetime
    expired_at: Optional[datetime]
    paid_at: Optional[datetime]
    refunded_at: Optional[datetime]
    transaction_id: Optional[str]
    refund_reason: Optional[str]
    gateway: Optional[str]


# ── Stats ──────────────────────────────────────────────────
class MerchantStats(BaseModel):
    id: int
    name: str
    status: str
    order_count: int
    total_quantity: int
    total_revenue: float


class SummaryStats(BaseModel):
    total_orders: int
    paid_orders: int
    pending_orders: int
    total_revenue: float
    refund_amount: float
    merchant_count: int
    today_orders: int
    wechat_revenue: float
    alipay_revenue: float
