import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration

from app.api import admin, auth, compliance, content, membership, payments
from app.core.config import settings
from app.core.database import close_db, get_db, init_db
from app.core.otel import setup_opentelemetry
from app.core.redis import close_redis, get_redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")

    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[FastApiIntegration()],
            environment=settings.ENVIRONMENT,
            traces_sample_rate=1.0,
        )
        logger.info("Sentry initialized")

    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.warning(f"Database init skipped: {e}")

    try:
        r = await get_redis()
        await r.ping()
        logger.info("Redis connected")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")

    yield

    logger.info("Shutting down...")
    await close_db()
    await close_redis()


app = FastAPI(
    title="NFT Fan Club Compliance API",
    description="Backend API for NFT-gated adult fan club compliance platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    setup_opentelemetry(app)
    logger.info("OpenTelemetry initialized")
except Exception as e:
    logger.warning(f"OpenTelemetry init skipped: {e}")


app.include_router(auth.router)
app.include_router(membership.router)
app.include_router(content.router)
app.include_router(compliance.router)
app.include_router(admin.router)
app.include_router(payments.router)


@app.get("/health")
async def health_check():
    db_status = "unknown"
    redis_status = "unknown"

    try:
        async for _ in get_db():
            db_status = "healthy"
            break
    except Exception as e:
        db_status = f"unhealthy: {e}"

    try:
        r = await get_redis()
        await r.ping()
        redis_status = "healthy"
    except Exception as e:
        redis_status = f"unhealthy: {e}"

    return {
        "status": "ok",
        "database": db_status,
        "redis": redis_status,
        "environment": settings.ENVIRONMENT,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
