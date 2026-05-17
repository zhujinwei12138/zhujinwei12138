"""add merchant_id to products for per-merchant menu isolation

Revision ID: 007
Revises: 006
Create Date: 2026-05-17

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("merchant_id", sa.BigInteger(), nullable=True),
    )
    op.create_foreign_key(
        "fk_products_merchant_id",
        "products", "merchants",
        ["merchant_id"], ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_products_merchant_id", "products", ["merchant_id"])


def downgrade() -> None:
    op.drop_index("ix_products_merchant_id", table_name="products")
    op.drop_constraint("fk_products_merchant_id", "products", type_="foreignkey")
    op.drop_column("products", "merchant_id")
