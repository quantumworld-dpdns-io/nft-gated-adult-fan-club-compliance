import dataclasses
import datetime
import json
import time
from typing import Any, Callable, Optional, TypeVar

from redis.asyncio import Redis

from app.core.config import settings

redis_client: Optional[Redis] = None


async def get_redis() -> Redis:
    global redis_client
    if redis_client is None:
        redis_client = Redis.from_url(  # type: ignore[call-overload]
            settings.REDIS_URL, decode_responses=True
        )
    return redis_client


async def close_redis() -> None:
    global redis_client
    if redis_client:
        await redis_client.aclose()
        redis_client = None


F = TypeVar("F", bound=Callable[..., Any])


def cache(ttl: int = 300) -> Callable[[F], F]:
    def decorator(func: F) -> F:
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache_key_data = {
                "args": [str(a) for a in args],
                "kwargs": {k: str(v) for k, v in kwargs.items()},
                "func": func.__name__,
            }
            key = f"cache:{func.__name__}:{hash(json.dumps(cache_key_data, sort_keys=True))}"
            r = await get_redis()
            cached = await r.get(key)
            if cached is not None:
                return json.loads(cached)
            result = await func(*args, **kwargs)
            serialized = json.dumps(
                result, default=_serialize, ensure_ascii=False
            )
            await r.setex(key, ttl, serialized)
            return result

        return wrapper  # type: ignore

    return decorator


def _serialize(obj: Any) -> str:
    if isinstance(obj, datetime.datetime):
        return obj.isoformat()
    if isinstance(obj, datetime.date):
        return obj.isoformat()
    if dataclasses.is_dataclass(obj):
        return dataclasses.asdict(obj)  # type: ignore[arg-type]
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return str(obj)


class token_blacklist:
    @staticmethod
    async def add(jti: str, expires_in: int = 3600) -> None:
        r = await get_redis()
        await r.setex(f"blacklist:{jti}", expires_in, "1")

    @staticmethod
    async def check(jti: str) -> bool:
        r = await get_redis()
        result = await r.exists(f"blacklist:{jti}")
        return bool(result)


class rate_limiter:
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def check(self, key: str) -> bool:
        r = await get_redis()
        now = int(time.time())
        window_key = f"ratelimit:{key}:{now // self.window_seconds}"
        count = await r.incr(window_key)
        if count == 1:
            await r.expire(window_key, self.window_seconds)
        return count <= self.max_requests

    async def __call__(self, key: str) -> bool:
        return await self.check(key)


class session_store:
    @staticmethod
    async def set(session_id: str, data: dict, ttl: int = 3600) -> None:
        r = await get_redis()
        await r.setex(
            f"session:{session_id}", ttl, json.dumps(data, default=_serialize)
        )

    @staticmethod
    async def get(session_id: str) -> Optional[dict]:
        r = await get_redis()
        data = await r.get(f"session:{session_id}")
        return json.loads(data) if data else None

    @staticmethod
    async def delete(session_id: str) -> None:
        r = await get_redis()
        await r.delete(f"session:{session_id}")
