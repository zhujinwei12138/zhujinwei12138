import logging
import os
import time
from contextlib import asynccontextmanager

from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import engine, Base, get_db
import redis_client as rc
from routers import admin_auth, merchants, orders, payments, products, stats
from seed import seed_if_empty

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _run_migrations() -> None:
    cfg = AlembicConfig(os.path.join(os.path.dirname(__file__), "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "alembic"))
    alembic_command.upgrade(cfg, "head")
    logger.info("Alembic migrations applied")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    rc.init_redis()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_migrations)
    await seed_if_empty()
    logger.info("Application started")
    yield
    await rc.close_redis()
    await engine.dispose()
    logger.info("Application stopped")


app = FastAPI(title="啤酒小程序 API", lifespan=lifespan)

# ── CORS ─────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Security headers ─────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


# ── Request logging ──────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    logger.info(
        "%s %s %d %.0fms",
        request.method,
        request.url.path,
        response.status_code,
        (time.time() - start) * 1000,
    )
    return response


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    await rc.redis.ping()
    return {"status": "ok", "db": "ok", "redis": "ok"}


# API routes
app.include_router(admin_auth.router)
app.include_router(products.router)
app.include_router(merchants.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(stats.router)

# Static frontends — mounted AFTER API routes so /api/* is never shadowed
_base = os.path.dirname(__file__)
app.mount("/customer", StaticFiles(directory=os.path.join(_base, "public/customer"), html=True), name="customer")
app.mount("/admin", StaticFiles(directory=os.path.join(_base, "public/admin"), html=True), name="admin")
