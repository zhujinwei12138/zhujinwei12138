"""add customers and admin_users tables, add customer_id to orders

Revision ID: 005
Revises: 004
Create Date: 2026-05-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("phone", name="uq_customers_phone"),
    )

    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="merchant_admin"),
        sa.Column(
            "merchant_id",
            sa.BigInteger(),
            sa.ForeignKey("merchants.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_admin_users_username", "admin_users", ["username"], unique=True)

    op.add_column(
        "orders",
        sa.Column(
            "customer_id",
            sa.String(36),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_order_customer_id", "orders", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_order_customer_id", "orders")
    op.drop_column("orders", "customer_id")
    op.drop_index("ix_admin_users_username", "admin_users")
    op.drop_table("admin_users")
    op.drop_table("customers")
