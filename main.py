import logging
import os
from contextlib import asynccontextmanager

from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from database import engine, Base
import redis_client as rc
from routers import merchants, orders, payments, products, stats
from seed import seed_if_empty

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _run_migrations() -> None:
    """Run pending Alembic migrations synchronously (called at startup)."""
    cfg = AlembicConfig(os.path.join(os.path.dirname(__file__), "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "alembic"))
    alembic_command.upgrade(cfg, "head")
    logger.info("Alembic migrations applied")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    # Startup
    rc.init_redis()
    # Run Alembic in a thread to avoid nested event-loop conflict
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_migrations)
    await seed_if_empty()
    logger.info("Application started")
    yield
    # Shutdown
    await rc.close_redis()
    await engine.dispose()
    logger.info("Application stopped")


app = FastAPI(title="啤酒小程序 API", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


# API routes
app.include_router(products.router)
app.include_router(merchants.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(stats.router)

# Static frontends — mounted AFTER API routes so /api/* is never shadowed
_base = os.path.dirname(__file__)
app.mount("/customer", StaticFiles(directory=os.path.join(_base, "public/customer"), html=True), name="customer")
app.mount("/admin", StaticFiles(directory=os.path.join(_base, "public/admin"), html=True), name="admin")
