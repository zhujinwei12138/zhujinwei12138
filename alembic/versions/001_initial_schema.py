"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("volume", sa.String(20), nullable=False, server_default=""),
        sa.Column("alcohol", sa.String(10), nullable=False, server_default=""),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("badge", sa.String(20), nullable=True),
        sa.Column("gradient", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "merchants",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("table_count", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "orders",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("merchant_id", sa.BigInteger(), nullable=False),
        sa.Column("table_no", sa.String(20), nullable=False),
        sa.Column("items", postgresql.JSONB(), nullable=False),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending_payment"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("preparing_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_merchant_id", "orders", ["merchant_id"])
    op.create_index("ix_order_status", "orders", ["status"])
    op.create_index("ix_order_created_at", "orders", ["created_at"])

    op.create_table(
        "payments",
        sa.Column("id", sa.String(50), nullable=False),
        sa.Column("order_id", sa.BigInteger(), nullable=False),
        sa.Column("merchant_id", sa.BigInteger(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("method", sa.String(20), nullable=False, server_default="wechat"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transaction_id", sa.String(100), nullable=True),
        sa.Column("refund_reason", sa.Text(), nullable=True),
        sa.Column("gateway", sa.String(20), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_order_id", "payments", ["order_id"])
    op.create_index("ix_payment_status", "payments", ["status"])


def downgrade() -> None:
    op.drop_index("ix_payment_status", table_name="payments")
    op.drop_index("ix_payment_order_id", table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_order_created_at", table_name="orders")
    op.drop_index("ix_order_status", table_name="orders")
    op.drop_index("ix_order_merchant_id", table_name="orders")
    op.drop_table("orders")
    op.drop_table("merchants")
    op.drop_table("products")
