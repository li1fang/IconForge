from fastapi import APIRouter

from app.api.v1.endpoints import forge, materials

api_router = APIRouter()


@api_router.get("/ping", tags=["health"])
async def ping() -> dict[str, str]:
    return {"message": "pong"}


api_router.include_router(materials.router)
api_router.include_router(forge.router)
