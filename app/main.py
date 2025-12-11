from __future__ import annotations

import os
from contextlib import asynccontextmanager
from http import HTTPStatus
from logging import getLogger
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_request_id, request_id_ctx_var
from app.core.security import enforce_rate_limit, verify_api_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan hook for model preload and setup."""

    if settings.enable_background_removal:
        from rembg import new_session

        os.environ.setdefault("U2NET_HOME", str(settings.model_cache_dir))
        settings.model_cache_dir.mkdir(parents=True, exist_ok=True)
        new_session("u2net")
    configure_logging()
    yield


app = FastAPI(title=settings.project_name, lifespan=lifespan)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Inject request ID into request state and logging context."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request_id = request.headers.get(settings.request_id_header) or str(uuid4())
        request.state.request_id = request_id
        token = request_id_ctx_var.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx_var.reset(token)
        response.headers[settings.request_id_header] = request_id
        return response


logger = getLogger(__name__)

app.add_middleware(RequestContextMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dependencies = []
if settings.enable_rate_limit:
    dependencies.append(Depends(enforce_rate_limit))
if settings.require_api_key:
    dependencies.append(Depends(verify_api_key))

app.include_router(api_router, prefix=settings.api_prefix, dependencies=dependencies)


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


def problem_response(
    request: Request,
    status_code: int,
    title: str,
    detail: str | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None) or get_request_id()
    response = JSONResponse(
        status_code=status_code,
        content={
            "type": "about:blank",
            "title": title,
            "status": status_code,
            "detail": detail,
            "instance": str(request.url),
            "request_id": request_id,
        },
    )
    response.headers[settings.request_id_header] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    try:
        title = HTTPStatus(exc.status_code).phrase
    except ValueError:
        title = "HTTP Error"

    return problem_response(
        request,
        status_code=exc.status_code,
        title=title,
        detail=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return problem_response(
        request,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        title="Validation Failed",
        detail=str(exc),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled application error", exc_info=exc)
    return problem_response(
        request,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        title="Internal Server Error",
        detail="An unexpected error occurred. Please try again later.",
    )
