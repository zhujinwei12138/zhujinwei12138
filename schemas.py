from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


# ── Product ────────────────────────────────────────────────
class ProductIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    volume: str = Field("", max_length=20)
    alcohol: str = Field("", max_length=10)
    price: float = Field(..., gt=0)
    category: Literal["精酿", "瓶装", "罐装"]
    badge: Optional[str] = Field(None, max_length=20)
    gradient: str = ""
    stock: Optional[int] = Field(None, ge=0)  # None = 不限库存


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
    stock: Optional[int]


# ── Merchant ───────────────────────────────────────────────
class MerchantIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = None
    address: Optional[str] = None
    table_count: int = Field(10, ge=1, le=500)
    status: Literal["active", "inactive"] = "active"


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
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=1)


# ── Order ──────────────────────────────────────────────────
class OrderIn(BaseModel):
    merchant_id: int = Field(..., gt=0)
    table_no: str = Field(..., min_length=1, max_length=20)
    items: list[OrderItem] = Field(..., min_length=1)
    total: float = Field(..., gt=0)


class OrderStatusIn(BaseModel):
    status: Literal["preparing", "completed", "cancelled"]


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
    order_id: int = Field(..., gt=0)
    method: Literal["wechat", "alipay"] = "wechat"


class RefundIn(BaseModel):
    reason: str = Field("管理员操作退款", min_length=1, max_length=200)


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
