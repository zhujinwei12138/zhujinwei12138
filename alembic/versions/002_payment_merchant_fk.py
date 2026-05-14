"""add payment merchant_id foreign key

Revision ID: 002
Revises: 001
Create Date: 2026-05-14

"""
from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_payments_merchant_id",
        "payments",
        "merchants",
        ["merchant_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_payments_merchant_id", "payments", type_="foreignkey")
