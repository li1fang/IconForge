from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    project_name: str = "IconForge"
    api_prefix: str = "/api/v1"
    temp_dir: Path = Path("/tmp/iconforge/temp")
    model_cache_dir: Path = Path("/tmp/iconforge/models")
    max_upload_size_bytes: int = 10 * 1024 * 1024
    allowed_image_extensions: tuple[str, ...] = (".png", ".jpg", ".jpeg", ".webp")
    allowed_image_formats: tuple[str, ...] = ("PNG", "JPEG", "WEBP")
    material_ttl_seconds: int = 60 * 60
    enable_background_removal: bool = True
    request_id_header: str = "X-Request-ID"
    enable_rate_limit: bool = False
    rate_limit_per_minute: int = 120
    require_api_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="ICONFORGE_", extra="ignore"
    )

    def model_post_init(self, __context: Any) -> None:
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.model_cache_dir.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""

    return Settings()


settings = get_settings()
