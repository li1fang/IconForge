from __future__ import annotations

import asyncio
import time
from collections import deque
from typing import Deque, Dict

from fastapi import Header, HTTPException, Request, status

from app.core.config import settings


class SimpleRateLimiter:
    """In-memory rate limiter with fixed window semantics."""

    def __init__(self, limit: int, window_seconds: int = 60):
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: Dict[str, Deque[float]] = {}
        self._lock = asyncio.Lock()

    async def allow(self, key: str) -> bool:
        async with self._lock:
            now = time.time()
            events = self._events.setdefault(key, deque())
            while events and now - events[0] >= self.window_seconds:
                events.popleft()
            if len(events) >= self.limit:
                return False
            events.append(now)
            return True


_rate_limiter = SimpleRateLimiter(limit=settings.rate_limit_per_minute)


async def enforce_rate_limit(request: Request) -> None:
    """Raise an HTTP 429 error when requests exceed the configured limit."""

    if not settings.enable_rate_limit:
        return

    client_host = request.client.host if request.client else "anonymous"
    allowed = await _rate_limiter.allow(client_host)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please retry later.",
        )


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Authenticate requests using a static API key when configured."""

    if settings.require_api_key is None:
        return

    if x_api_key != settings.require_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key provided.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
