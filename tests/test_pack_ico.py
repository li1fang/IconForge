import io
import struct

import pytest
from PIL import Image

from app.services.pack_ico import EXPECTED_ICON_SIZES, pack_ico


def create_icon(size: int, color=(255, 0, 0, 255)) -> bytes:
    image = Image.new("RGBA", (size, size), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_pack_ico_validates_required_sizes():
    icons = {size: create_icon(size) for size in EXPECTED_ICON_SIZES if size != 16}

    with pytest.raises(ValueError, match="include 16"):
        pack_ico(icons)


def test_pack_ico_rejects_incorrect_dimensions():
    icons = {size: create_icon(size) for size in EXPECTED_ICON_SIZES}
    off_size = Image.new("RGBA", (20, 18), (0, 255, 0, 255))
    buffer = io.BytesIO()
    off_size.save(buffer, format="PNG")
    icons[16] = buffer.getvalue()

    with pytest.raises(ValueError):
        pack_ico(icons)


def test_pack_ico_generates_multi_frame_ico():
    icons = {size: create_icon(size, color=(size, 0, 0, 255)) for size in EXPECTED_ICON_SIZES}

    ico_bytes = pack_ico(icons)

    reserved, icon_type, count = struct.unpack("<HHH", ico_bytes[:6])
    assert reserved == 0
    assert icon_type == 1
    assert count == len(EXPECTED_ICON_SIZES)

    offset = 6
    frame_sizes = set()
    for _ in range(count):
        width, height, *_rest, _, _, size_bytes, _ = struct.unpack(
            "<BBBBHHII", ico_bytes[offset : offset + 16]
        )
        frame_sizes.add((width or 256, height or 256))
        offset += 16

    assert frame_sizes == {(size, size) for size in EXPECTED_ICON_SIZES}
