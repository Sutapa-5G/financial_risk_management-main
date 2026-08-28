from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Vite's default dev port is 5173; 3000 and 8080 cover alternate setups.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]

    class Config:
        env_prefix = "RISK_NAVIGATOR_"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()