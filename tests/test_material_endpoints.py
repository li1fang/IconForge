import io
import struct
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core import deps
from app.main import app
from app.services.image_processing import ImagePipeline, ResampleAlgorithm


def create_png(size: int, color=(255, 0, 0, 255)) -> bytes:
    image = Image.new("RGBA", (size, size), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def client_pipeline(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    monkeypatch.setattr("app.core.config.settings.enable_background_removal", False)
    pipeline = ImagePipeline(background_removal_enabled=False)
    app.dependency_overrides[deps.get_image_pipeline] = lambda: pipeline
    yield pipeline
    app.dependency_overrides.clear()


def test_upload_rejects_large_files(client_pipeline, monkeypatch):
    monkeypatch.setattr("app.services.image_processing.settings.max_upload_size_bytes", 10)
    oversized = create_png(4)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/materials/upload",
            files={"file": ("large.png", oversized, "image/png")},
        )

    assert response.status_code == 400
    assert "maximum size" in response.json()["detail"]


def test_upload_rejects_non_image_payload(client_pipeline):
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/materials/upload",
            files={"file": ("fake.png", b"not an image", "image/png")},
        )

    assert response.status_code == 400
    assert "valid image" in response.json()["detail"]


def test_missing_material_returns_404(client_pipeline):
    missing_id = uuid4().hex

    with TestClient(app) as client:
        response = client.get(f"/api/v1/materials/{missing_id}")

    assert response.status_code == 404


def test_end_to_end_flow_through_forge(client_pipeline):
    source_png = create_png(96, color=(0, 0, 255, 255))

    with TestClient(app) as client:
        upload_response = client.post(
            "/api/v1/materials/upload",
            files={"file": ("source.png", source_png, "image/png")},
        )

        assert upload_response.status_code == 201
        material_id = upload_response.json()["material_id"]

        preview_response = client.get(
            f"/api/v1/materials/{material_id}/preview",
            params={"algo": ResampleAlgorithm.LANCZOS.value, "size": 48},
        )
        assert preview_response.status_code == 200
        assert preview_response.json()["image_base64"].startswith("data:image/png;base64,")

        tiny_icon = create_png(16, color=(0, 255, 0, 255))
        forge_response = client.post(
            "/api/v1/forge",
            data={"source_id": material_id, "mid_algo": ResampleAlgorithm.NEAREST.value},
            files={"tiny_icon": ("tiny.png", tiny_icon, "image/png")},
        )

    assert forge_response.status_code == 200
    assert forge_response.headers.get("content-type") == "application/octet-stream"

    reserved, icon_type, count = struct.unpack("<HHH", forge_response.content[:6])
    assert reserved == 0
    assert icon_type == 1
    assert count == 4
