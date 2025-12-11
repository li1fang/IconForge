import asyncio
import io
import struct

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core import deps
from app.main import app
from app.services.image_processing import ImagePipeline, ResampleAlgorithm


def create_png(size: int, color=(128, 128, 128, 255)) -> bytes:
    image = Image.new("RGBA", (size, size), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def pipeline(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    monkeypatch.setattr("app.core.config.settings.enable_background_removal", False)
    pipeline = ImagePipeline(background_removal_enabled=False)
    app.dependency_overrides[deps.get_image_pipeline] = lambda: pipeline
    yield pipeline
    app.dependency_overrides.clear()


def test_forge_endpoint_generates_ico(pipeline):
    source_png = create_png(64, color=(255, 0, 0, 255))
    material = asyncio.run(pipeline.process_upload(source_png, "source.png"))

    tiny_icon = create_png(16, color=(0, 255, 0, 255))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/forge",
            data={"source_id": material.material_id, "mid_algo": ResampleAlgorithm.NEAREST.value},
            files={"tiny_icon": ("tiny.png", tiny_icon, "image/png")},
        )

    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/octet-stream"
    assert response.headers.get("content-disposition", "").endswith(".ico\"")

    reserved, icon_type, count = struct.unpack("<HHH", response.content[:6])
    assert reserved == 0
    assert icon_type == 1
    assert count == 4

    offset = 6
    frame_sizes = set()
    for _ in range(count):
        width, height, *_rest, _, _, size_bytes, _ = struct.unpack(
            "<BBBBHHII", response.content[offset : offset + 16]
        )
        frame_sizes.add((width or 256, height or 256))
        offset += 16

    assert frame_sizes == {(256, 256), (48, 48), (32, 32), (16, 16)}


def test_forge_endpoint_rejects_bad_tiny_icon(pipeline):
    source_png = create_png(128, color=(0, 0, 255, 255))
    material = asyncio.run(pipeline.process_upload(source_png, "source.png"))

    wrong_tiny = create_png(20)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/forge",
            data={"source_id": material.material_id, "mid_algo": ResampleAlgorithm.LANCZOS.value},
            files={"tiny_icon": ("tiny.png", wrong_tiny, "image/png")},
        )

    assert response.status_code == 400
    assert "16px" in response.json()["detail"]
