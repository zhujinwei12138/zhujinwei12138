"""fix audit_logs.detail column type from JSON to JSONB

Revision ID: 008
Revises: 007
Create Date: 2026-05-20

JSONB provides better query performance and GIN index support over plain JSON.
Migration 006 accidentally used sa.JSON() — this corrects existing installs.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only PostgreSQL supports JSONB; skip on SQLite (used in tests)
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.alter_column(
        "audit_logs", "detail",
        existing_type=sa.JSON(),
        type_=sa.dialects.postgresql.JSONB(),
        postgresql_using="detail::jsonb",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.alter_column(
        "audit_logs", "detail",
        existing_type=sa.dialects.postgresql.JSONB(),
        type_=sa.JSON(),
        postgresql_using="detail::json",
    )
