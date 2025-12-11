from functools import lru_cache

from app.core.config import settings
from app.services.image_processing import ImagePipeline


@lru_cache(maxsize=1)
def get_image_pipeline() -> ImagePipeline:
    return ImagePipeline(background_removal_enabled=settings.enable_background_removal)
