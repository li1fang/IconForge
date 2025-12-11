from __future__ import annotations

import io
import struct
from typing import Mapping

from PIL import Image

EXPECTED_ICON_SIZES = (256, 48, 32, 16)


def _load_icon_image(content: bytes, expected_size: int) -> Image.Image:
    """Load an RGBA image and validate it matches the expected square size."""

    try:
        image = Image.open(io.BytesIO(content)).convert("RGBA")
    except Exception as exc:  # pragma: no cover - Pillow already detailed
        raise ValueError("Invalid image data for icon generation") from exc

    width, height = image.size
    if width != height or width != expected_size:
        raise ValueError(
            f"Icon for {expected_size}px must be a square of exactly {expected_size}x{expected_size} pixels"
        )

    return image


def pack_ico(icons: Mapping[int, bytes]) -> bytes:
    """Validate provided icon sizes and pack them into a multi-size ICO byte stream."""

    missing = set(EXPECTED_ICON_SIZES) - set(icons.keys())
    if missing:
        missing_sizes = ", ".join(map(str, sorted(missing)))
        raise ValueError(f"Icon sizes must include {missing_sizes} pixels")

    validated = []
    for size in EXPECTED_ICON_SIZES:
        image = _load_icon_image(icons[size], size)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        validated.append((size, buffer.getvalue()))

    header = struct.pack("<HHH", 0, 1, len(validated))
    offset = 6 + 16 * len(validated)
    directories = []
    for size, data in validated:
        width = 0 if size == 256 else size
        height = 0 if size == 256 else size
        entry = struct.pack(
            "<BBBBHHII", width, height, 0, 0, 1, 32, len(data), offset
        )
        directories.append(entry)
        offset += len(data)

    return header + b"".join(directories) + b"".join(data for _, data in validated)
