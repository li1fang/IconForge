from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette import status

from app.core.deps import get_image_pipeline
from app.models.responses import MaterialResponse, PreviewResponse
from app.services.image_processing import (
    ImagePipeline,
    ResampleAlgorithm,
    encode_image_base64,
)

router = APIRouter(prefix="/materials", tags=["materials"])


@router.post("/upload", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
async def upload_material(
    file: Annotated[UploadFile, File(..., description="Source image")],
    pipeline: Annotated[ImagePipeline, Depends(get_image_pipeline)],
) -> MaterialResponse:
    content = await file.read()
    try:
        material = await pipeline.process_upload(content, file.filename or "upload.png")
        image_bytes = await pipeline.get_material_bytes(material.material_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - FastAPI converts to 500
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return MaterialResponse(
        material_id=material.material_id,
        width=material.width,
        height=material.height,
        crop_box=list(material.crop_box),
        padding=material.padding,
        image_base64=encode_image_base64(image_bytes),
    )


@router.get("/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: str, pipeline: Annotated[ImagePipeline, Depends(get_image_pipeline)]
) -> MaterialResponse:
    try:
        material = await pipeline.get_material(material_id)
        image_bytes = await pipeline.get_material_bytes(material_id)
    except Exception as exc:  # pragma: no cover - FastAPI converts to 404/500
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return MaterialResponse(
        material_id=material.material_id,
        width=material.width,
        height=material.height,
        crop_box=list(material.crop_box),
        padding=material.padding,
        image_base64=encode_image_base64(image_bytes),
    )


@router.get("/{material_id}/preview", response_model=PreviewResponse)
async def get_preview(
    material_id: str,
    algo: ResampleAlgorithm,
    pipeline: Annotated[ImagePipeline, Depends(get_image_pipeline)],
    size: int = 48,
) -> PreviewResponse:
    if size not in {32, 48}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Preview size must be either 32 or 48 pixels",
        )
    try:
        preview_bytes = await pipeline.get_preview_bytes(material_id, algo, size)
    except Exception as exc:  # pragma: no cover - FastAPI converts to 404/500
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return PreviewResponse(
        material_id=material_id,
        algorithm=algo.value,
        size=size,
        image_base64=encode_image_base64(preview_bytes),
    )
