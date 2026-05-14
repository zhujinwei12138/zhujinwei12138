import asyncio
import os
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Alembic Config object
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import metadata from our models
from models import Base  # noqa: E402

target_metadata = Base.metadata

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://beer:beer@localhost:5432/beerdb"
)


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (generates SQL)."""
    # Offline mode uses a sync-compatible URL
    sync_url = DATABASE_URL.replace("+asyncpg", "")
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live DB using the async engine."""
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
