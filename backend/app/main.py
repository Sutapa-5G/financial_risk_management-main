from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import model_perf, portfolio, scoring, stress
from app.config import get_settings

logger = logging.getLogger("risk_navigator")

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not (ARTIFACTS_DIR / "pd_model.joblib").exists():
        raise RuntimeError(
            "No trained model found in /artifacts. Run `python -m app.ml.train` "
            "from the backend/ directory first."
        )
    # Warm the model + portfolio caches at startup rather than on first request.
    from app.data_store.portfolio_store import get_portfolio
    from app.ml.model import get_model

    get_model()
    get_portfolio()
    logger.info("Model and portfolio loaded.")
    yield


app = FastAPI(
    title="Risk Navigator API",
    description="Credit risk scoring, portfolio analytics and model performance for Risk Navigator.",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio.router)
app.include_router(scoring.router)
app.include_router(model_perf.router)
app.include_router(stress.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
