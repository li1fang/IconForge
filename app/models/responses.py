from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class MaterialResponse(BaseModel):
    material_id: str = Field(..., description="Unique identifier for the uploaded material")
    width: int
    height: int
    crop_box: List[int] = Field(..., description="Crop box used during smart crop [left, top, right, bottom]")
    padding: int = Field(..., description="Padding in pixels applied around the bounding box")
    image_base64: str = Field(..., description="Base64 encoded 256px PNG ready for previews")


class PreviewResponse(BaseModel):
    material_id: str
    algorithm: str
    size: int
    image_base64: str
