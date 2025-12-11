from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "IconForge"
    api_prefix: str = "/api/v1"
    temp_dir: Path = Path("/tmp/iconforge/temp")
    model_cache_dir: Path = Path("/tmp/iconforge/models")
    max_upload_size: int = 10 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", env_prefix="ICONFORGE_", extra="ignore")

    def model_post_init(self, __context: Any) -> None:
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.model_cache_dir.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
