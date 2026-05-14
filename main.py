import logging
import os
from contextlib import asynccontextmanager

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    rc.init_redis()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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
