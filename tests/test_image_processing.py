import io

import pytest
from PIL import Image

from app.services.image_processing import (
    ImagePipeline,
    MaterialNotFoundError,
    ResampleAlgorithm,
    resize_image,
    smart_crop,
)


def create_alpha_image(width: int, height: int, box: tuple[int, int, int, int]) -> Image.Image:
    base = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    for x in range(x0, x1):
        for y in range(y0, y1):
            base.putpixel((x, y), (255, 0, 0, 255))
    return base


def test_smart_crop_recenters_and_pads():
    # Draw a 20x20 square offset to the left
    image = create_alpha_image(200, 200, (20, 80, 40, 100))

    cropped, crop_box, padding = smart_crop(image)

    assert crop_box[0] <= 20 <= crop_box[2]
    assert padding >= 2
    assert cropped.width == cropped.height
    center_pixel = cropped.getpixel((cropped.width // 2, cropped.height // 2))
    assert center_pixel[3] == 255


def test_resize_algorithms_diverge():
    base = Image.new("RGBA", (2, 2), (0, 0, 0, 255))
    base.putpixel((0, 0), (255, 255, 255, 255))
    base.putpixel((1, 1), (255, 255, 255, 255))

    nearest = resize_image(base, 4, ResampleAlgorithm.NEAREST)
    bilinear = resize_image(base, 4, ResampleAlgorithm.BILINEAR)

    assert nearest.size == (4, 4)
    assert bilinear.size == (4, 4)

    sharp_values = {nearest.getpixel((1, 1)), nearest.getpixel((2, 2))}
    smooth_value = bilinear.getpixel((1, 1))

    assert len(sharp_values) == 1  # Nearest keeps solid pixels
    assert smooth_value[0] < 255  # Bilinear blends values


@pytest.mark.asyncio
async def test_pipeline_process_upload_without_background_removal(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    pipeline = ImagePipeline(background_removal_enabled=False)

    image = create_alpha_image(64, 64, (10, 10, 30, 30))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    record = await pipeline.process_upload(buffer.getvalue(), "test.png")

    assert record.material_id
    assert record.width == 256
    assert record.height == 256

    first_preview = await pipeline.get_preview_bytes(record.material_id, ResampleAlgorithm.NEAREST, 32)
    second_preview = await pipeline.get_preview_bytes(record.material_id, ResampleAlgorithm.NEAREST, 32)

    assert first_preview == second_preview  # cached response


@pytest.mark.asyncio
async def test_pipeline_crops_without_background_removal(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    pipeline = ImagePipeline(background_removal_enabled=False)

    monkeypatch.setattr(
        pipeline,
        "_remove_background",
        lambda image: (_ for _ in ()).throw(AssertionError("rembg should be skipped")),
    )

    image = create_alpha_image(64, 64, (30, 30, 34, 34))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    record = await pipeline.process_upload(buffer.getvalue(), "plain.png")

    left, top, right, bottom = record.crop_box
    assert right - left <= 8
    assert bottom - top <= 8


@pytest.mark.asyncio
async def test_pipeline_rejects_non_image(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    pipeline = ImagePipeline(background_removal_enabled=False)

    with pytest.raises(ValueError, match="valid image"):
        await pipeline.process_upload(b"not an image", "fake.png")


@pytest.mark.asyncio
async def test_pipeline_rejects_oversized_upload(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    monkeypatch.setattr("app.services.image_processing.settings.max_upload_size_bytes", 10)
    pipeline = ImagePipeline(background_removal_enabled=False)

    small_image = Image.new("RGBA", (1, 1), (255, 255, 255, 255))
    buffer = io.BytesIO()
    small_image.save(buffer, format="PNG")

    with pytest.raises(ValueError, match="exceeds maximum size"):
        await pipeline.process_upload(buffer.getvalue(), "tiny.png")


@pytest.mark.asyncio
async def test_pipeline_rejects_invalid_extension(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    pipeline = ImagePipeline(background_removal_enabled=False)

    image = Image.new("RGBA", (4, 4), (255, 0, 0, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    with pytest.raises(ValueError, match="Unsupported file extension"):
        await pipeline.process_upload(buffer.getvalue(), "sample.bmp")


@pytest.mark.asyncio
async def test_pipeline_rejects_mismatched_format(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    pipeline = ImagePipeline(background_removal_enabled=False)

    png_buffer = io.BytesIO()
    Image.new("RGBA", (4, 4), (0, 255, 0, 255)).save(png_buffer, format="PNG")

    with pytest.raises(ValueError, match="does not match detected image format"):
        await pipeline.process_upload(png_buffer.getvalue(), "photo.jpg")


@pytest.mark.asyncio
async def test_expired_materials_are_evicted(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    monkeypatch.setattr("app.services.image_processing.settings.material_ttl_seconds", 1)
    pipeline = ImagePipeline(background_removal_enabled=False)

    original_time = lambda: 1000.0
    monkeypatch.setattr("app.services.image_processing.time.time", original_time)

    image = create_alpha_image(32, 32, (5, 5, 15, 15))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    record = await pipeline.process_upload(buffer.getvalue(), "old.png")

    monkeypatch.setattr("app.services.image_processing.time.time", lambda: 1002.0)

    with pytest.raises(MaterialNotFoundError):
        await pipeline.get_material(record.material_id)

    assert not (tmp_path / record.material_id).exists()


@pytest.mark.asyncio
async def test_expired_materials_purge_preview_cache(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.image_processing.settings.temp_dir", tmp_path)
    monkeypatch.setattr("app.services.image_processing.settings.material_ttl_seconds", 1)
    clock = {"now": 1000.0}
    monkeypatch.setattr("app.services.image_processing.time.time", lambda: clock["now"])

    pipeline = ImagePipeline(background_removal_enabled=False)

    image = create_alpha_image(16, 16, (2, 2, 5, 5))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    record = await pipeline.process_upload(buffer.getvalue(), "kept.png")
    await pipeline.get_preview_bytes(record.material_id, ResampleAlgorithm.LANCZOS, 8)
    assert pipeline.preview_cache

    clock["now"] = 1003.0
    pipeline._evict_expired()

    assert pipeline.preview_cache == {}
    assert record.material_id not in pipeline.materials
    assert not (tmp_path / record.material_id).exists()
