from __future__ import annotations

import asyncio
import base64
import io
import math
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Dict, Tuple
from uuid import uuid4

import numpy as np
from PIL import Image

from app.core.config import settings


class ResampleAlgorithm(str, Enum):
    LANCZOS = "LANCZOS"
    NEAREST = "NEAREST"
    BILINEAR = "BILINEAR"

    @property
    def pillow_filter(self) -> int:
        mapping = {
            ResampleAlgorithm.LANCZOS: Image.LANCZOS,
            ResampleAlgorithm.NEAREST: Image.NEAREST,
            ResampleAlgorithm.BILINEAR: Image.BILINEAR,
        }
        return mapping[self]


@dataclass
class MaterialRecord:
    material_id: str
    original_path: Path
    processed_path: Path
    width: int
    height: int
    crop_box: Tuple[int, int, int, int]
    padding: int


class MaterialNotFoundError(KeyError):
    """Raised when a material id cannot be resolved."""


class ImagePipeline:
    def __init__(self, background_removal_enabled: bool = True):
        self.background_removal_enabled = background_removal_enabled
        self.materials: Dict[str, MaterialRecord] = {}
        self.preview_cache: Dict[tuple[str, ResampleAlgorithm, int], bytes] = {}
        self._rembg_session = None
        settings.temp_dir.mkdir(parents=True, exist_ok=True)

    async def process_upload(self, content: bytes, filename: str) -> MaterialRecord:
        self._validate_size(content)
        image = await asyncio.to_thread(self._load_image, content)
        if self.background_removal_enabled:
            image = await asyncio.to_thread(self._remove_background, image)
        cropped, crop_box, padding = await asyncio.to_thread(smart_crop, image)
        processed = cropped.resize((256, 256), Image.LANCZOS)

        material_id = uuid4().hex
        material_dir = settings.temp_dir / material_id
        material_dir.mkdir(parents=True, exist_ok=True)

        original_path = material_dir / Path(filename).name
        processed_path = material_dir / "processed_256.png"

        await asyncio.to_thread(self._save_image, image, original_path)
        await asyncio.to_thread(self._save_image, processed, processed_path)

        record = MaterialRecord(
            material_id=material_id,
            original_path=original_path,
            processed_path=processed_path,
            width=processed.width,
            height=processed.height,
            crop_box=crop_box,
            padding=padding,
        )
        self.materials[material_id] = record
        return record

    async def get_material(self, material_id: str) -> MaterialRecord:
        try:
            return self.materials[material_id]
        except KeyError as exc:  # pragma: no cover - defensive
            raise MaterialNotFoundError(material_id) from exc

    async def get_material_bytes(self, material_id: str) -> bytes:
        record = await self.get_material(material_id)
        return await asyncio.to_thread(self._read_bytes, record.processed_path)

    async def get_preview_bytes(
        self, material_id: str, algo: ResampleAlgorithm, size: int
    ) -> bytes:
        cache_key = (material_id, algo, size)
        if cache_key in self.preview_cache:
            return self.preview_cache[cache_key]

        record = await self.get_material(material_id)
        processed = await asyncio.to_thread(Image.open, record.processed_path)
        preview = await asyncio.to_thread(resize_image, processed, size, algo)

        buffer = io.BytesIO()
        await asyncio.to_thread(preview.save, buffer, format="PNG")
        data = buffer.getvalue()
        self.preview_cache[cache_key] = data
        return data

    def _validate_size(self, content: bytes) -> None:
        if len(content) > settings.max_upload_size_bytes:
            raise ValueError("Uploaded file exceeds maximum size limit")

    def _load_image(self, content: bytes) -> Image.Image:
        image = Image.open(io.BytesIO(content))
        return image.convert("RGBA")

    def _remove_background(self, image: Image.Image) -> Image.Image:
        from rembg import new_session, remove

        if not self._rembg_session:
            self._rembg_session = new_session("u2net")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        result = remove(buffer.getvalue(), session=self._rembg_session)
        return Image.open(io.BytesIO(result)).convert("RGBA")

    def _save_image(self, image: Image.Image, path: Path) -> None:
        image.save(path, format="PNG")

    def _read_bytes(self, path: Path) -> bytes:
        return path.read_bytes()


def smart_crop(image: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int], int]:
    """Crop to non-transparent content, recentre, and add 10% padding."""

    array = np.array(image)
    alpha = array[:, :, 3]
    non_zero = np.argwhere(alpha > 0)

    if non_zero.size == 0:
        padding = max(2, math.ceil(max(image.size) * 0.1))
        box = (0, 0, image.width, image.height)
        return image, box, padding

    (ymin, xmin), (ymax, xmax) = non_zero.min(axis=0), non_zero.max(axis=0)
    padding = max(2, math.ceil(max(xmax - xmin + 1, ymax - ymin + 1) * 0.10))

    left = max(0, xmin - padding)
    upper = max(0, ymin - padding)
    right = min(image.width, xmax + padding + 1)
    lower = min(image.height, ymax + padding + 1)

    cropped = image.crop((left, upper, right, lower))
    square_size = max(cropped.width, cropped.height)
    square = Image.new("RGBA", (square_size, square_size), (0, 0, 0, 0))

    offset_x = (square_size - cropped.width) // 2
    offset_y = (square_size - cropped.height) // 2
    square.paste(cropped, (offset_x, offset_y))

    return square, (left, upper, right, lower), padding


def resize_image(
    image: Image.Image, size: int, algo: ResampleAlgorithm
) -> Image.Image:
    """Resize image to the requested size using the specified algorithm."""

    return image.resize((size, size), algo.pillow_filter)


def encode_image_base64(image_bytes: bytes) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/png;base64,{encoded}"
