import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://beer:beer@localhost:5432/beerdb"
)

_pool_kwargs: dict = {}
if "sqlite" not in DATABASE_URL:
    _pool_kwargs = {"pool_size": 20, "max_overflow": 10, "pool_recycle": 3600}

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True, **_pool_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
