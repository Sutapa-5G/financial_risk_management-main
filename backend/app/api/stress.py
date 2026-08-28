"""
Portfolio-level stress test.

Unlike the original front-end mock (a hand-tuned formula with no model
behind it), this re-runs the *actual trained model* across the whole
portfolio twice: once as-is, and once with each loan's debt-to-income and
interest rate shifted by the requested macro shocks. This is a simple but
genuine what-if simulation - a real desk would calibrate the
shock-to-feature mapping against historical stress episodes; here it's a
transparent, documented approximation:

  - Unemployment shock -> DTI rises (income pressure / reduced hours), and
    credit utilization drifts up slightly as borrowers lean on revolving
    credit.
  - Interest rate shock -> both the loan's own rate and DTI rise (variable-
    rate exposure, or refinancing at the new base rate).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter

from app.data_store.portfolio_store import get_portfolio, get_portfolio_features
from app.ml.dataset import FEATURE_COLUMNS
from app.ml.model import estimate_lgd, get_model
from app.schemas import StressTestRequest, StressTestResult

router = APIRouter(prefix="/api/stress-test", tags=["stress-test"])


def _apply_shocks(features: pd.DataFrame, unemployment_shock: float, rate_shock: float) -> pd.DataFrame:
    shocked = features.copy()
    shocked["dti"] = np.clip(
        shocked["dti"] + unemployment_shock * 0.9 + rate_shock * 0.35, 0, 75
    )
    shocked["credit_utilization"] = np.clip(
        shocked["credit_utilization"] + unemployment_shock * 0.6, 0, 100
    )
    shocked["interest_rate"] = np.clip(shocked["interest_rate"] + rate_shock, 3.5, 32)
    return shocked


@router.post("", response_model=StressTestResult, response_model_by_alias=True)
def run_stress_test(payload: StressTestRequest) -> StressTestResult:
    model = get_model()
    loans = get_portfolio()
    features = get_portfolio_features()[FEATURE_COLUMNS]
    amounts = np.array([l.amount for l in loans])

    baseline_pd = model.model.predict_proba(features)[:, 1]
    baseline_lgd = np.array([estimate_lgd(u) for u in features["credit_utilization"]])
    baseline_el = amounts * baseline_pd * baseline_lgd

    shocked_features = _apply_shocks(features, payload.unemployment_shock, payload.interest_rate_shock)
    stressed_pd = model.model.predict_proba(shocked_features)[:, 1]
    stressed_lgd = np.array([estimate_lgd(u) for u in shocked_features["credit_utilization"]])
    stressed_el = amounts * stressed_pd * stressed_lgd

    total_exposure = amounts.sum()
    baseline_rate = float((baseline_pd * amounts).sum() / total_exposure)
    stressed_rate = float((stressed_pd * amounts).sum() / total_exposure)
    baseline_loss = float(baseline_el.sum())
    stressed_loss = float(stressed_el.sum())

    return StressTestResult(
        baseline_default_rate=round(baseline_rate, 4),
        stressed_default_rate=round(stressed_rate, 4),
        baseline_expected_loss=round(baseline_loss, 2),
        stressed_expected_loss=round(stressed_loss, 2),
        delta_expected_loss=round(stressed_loss - baseline_loss, 2),
    )
