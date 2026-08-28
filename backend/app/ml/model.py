"""
Loads the trained PD model once at process startup and exposes prediction +
SHAP-based feature attribution used by the /api/score endpoint.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.ml.dataset import FEATURE_COLUMNS

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"

FEATURE_LABELS = {
    "income": "Annual Income",
    "loan_amount": "Loan Amount",
    "credit_utilization": "Credit Utilization",
    "dti": "Debt-to-Income",
    "credit_history": "Credit History Length",
    "open_accounts": "Open Accounts",
    "employment_length": "Employment Length",
    "interest_rate": "Interest Rate",
}


def tier_from_score(score: int) -> str:
    if score < 30:
        return "Low"
    if score < 55:
        return "Medium"
    if score < 78:
        return "High"
    return "Critical"


def pd_to_score(pd_value: float) -> int:
    """Map a raw probability of default onto the 1-99 display score used
    throughout the UI (kept identical to the original front-end formula so
    tier thresholds / gauge behaviour don't need to change)."""
    return int(round(min(99, max(1, (pd_value**0.55) * 128))))


def estimate_lgd(credit_utilization: float) -> float:
    """Loss-given-default as a simple function of utilization, standing in
    for a full LGD sub-model (collateral type, seniority, recovery lags...).
    Documented as a simplifying assumption - see README for how to replace
    it with a real regression."""
    return round(min(0.75, 0.32 + credit_utilization / 320), 3)


class PDModel:
    def __init__(self) -> None:
        self.model = joblib.load(ARTIFACTS_DIR / "pd_model.joblib")
        self.background: pd.DataFrame = joblib.load(ARTIFACTS_DIR / "shap_background.joblib")
        self.metrics = json.loads((ARTIFACTS_DIR / "metrics.json").read_text())
        self._explainer = None

    @property
    def explainer(self):
        if self._explainer is None:
            import shap  # imported lazily so the app can still boot without shap installed

            self._explainer = shap.TreeExplainer(
                self.model,
                data=self.background,
                model_output="probability",
            )
        return self._explainer

    def _to_frame(self, borrower: dict) -> pd.DataFrame:
        row = {c: [borrower[c]] for c in FEATURE_COLUMNS}
        return pd.DataFrame(row)[FEATURE_COLUMNS]

    def predict_pd(self, borrower: dict) -> float:
        frame = self._to_frame(borrower)
        return float(self.model.predict_proba(frame)[0, 1])

    def explain(self, borrower: dict) -> list[dict]:
        """Real SHAP feature attributions for a single borrower, in log-odds
        contribution to the predicted probability of default. Falls back to
        a permutation-style local sensitivity if shap isn't installed."""
        frame = self._to_frame(borrower)
        try:
            shap_values = self.explainer(frame)
            values = np.asarray(shap_values.values)[0]
        except ImportError:
            values = self._fallback_attribution(frame)

        contributions = [
            {"label": FEATURE_LABELS[c], "value": round(float(v), 4)}
            for c, v in zip(FEATURE_COLUMNS, values)
        ]
        contributions.sort(key=lambda c: abs(c["value"]), reverse=True)
        return contributions

    def _fallback_attribution(self, frame: pd.DataFrame) -> np.ndarray:
        """Occlusion-based sensitivity: replace each feature with the
        background mean one at a time and measure the change in predicted
        probability. Cruder than SHAP but needs no extra dependency."""
        base = self.model.predict_proba(frame)[0, 1]
        means = self.background.mean()
        deltas = []
        for c in FEATURE_COLUMNS:
            perturbed = frame.copy()
            perturbed[c] = means[c]
            p = self.model.predict_proba(perturbed)[0, 1]
            deltas.append(base - p)
        return np.array(deltas)


@lru_cache(maxsize=1)
def get_model() -> PDModel:
    return PDModel()
