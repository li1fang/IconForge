from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from starlette import status

from app.core.deps import get_image_pipeline
from app.services.image_processing import (
    ImagePipeline,
    MaterialNotFoundError,
    ResampleAlgorithm,
)
from app.services.pack_ico import pack_ico

router = APIRouter(prefix="/forge", tags=["forge"])


@router.post("", response_class=Response)
async def forge_icon(
    source_id: Annotated[str, Form(..., description="Material identifier")],
    mid_algo: Annotated[
        ResampleAlgorithm, Form(..., description="Resample algorithm for 48/32 previews")
    ],
    tiny_icon: Annotated[UploadFile, File(..., description="16x16 PNG icon")],
    pipeline: Annotated[ImagePipeline, Depends(get_image_pipeline)],
) -> Response:
    tiny_bytes = await tiny_icon.read()

    try:
        base_bytes = await pipeline.get_material_bytes(source_id)
        preview_48 = await pipeline.get_preview_bytes(source_id, mid_algo, 48)
        preview_32 = await pipeline.get_preview_bytes(source_id, mid_algo, 32)
        ico_bytes = pack_ico({256: base_bytes, 48: preview_48, 32: preview_32, 16: tiny_bytes})
    except MaterialNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    headers = {"Content-Disposition": f"attachment; filename=\"{source_id}.ico\""}
    return Response(content=ico_bytes, media_type="application/octet-stream", headers=headers)
