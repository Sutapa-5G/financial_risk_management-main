"""
Builds and holds the demo loan portfolio in memory.

Every loan in the book is scored by the *real* trained model (not a
hardcoded formula), so the KPIs, tables and charts on the Overview and
Portfolio Analytics pages are genuinely derived from model output. Swap
`_generate_portfolio` for a real loan-book loader (DB / CSV / warehouse
query) when you have one - everything downstream (`get_summary`,
`get_tier_breakdown`, etc.) just consumes the resulting list of `Loan` rows
and doesn't care where they came from.
"""

from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

import numpy as np
import pandas as pd

from app.ml.dataset import generate_borrowers
from app.ml.model import estimate_lgd, get_model, pd_to_score, tier_from_score
from app.schemas import Loan, PortfolioSummary, TierBreakdownRow, TrendPoint

STATUSES = ["Approved", "Pending", "Declined", "Current", "Delinquent"]
TIER_ORDER = ["Low", "Medium", "High", "Critical"]
PORTFOLIO_SIZE = 240
SEED = 20260817


def _pick_status(tier: str, rng: np.random.Generator) -> str:
    if tier == "Critical" and rng.random() > 0.45:
        return "Delinquent" if rng.random() > 0.5 else "Declined"
    return STATUSES[int(rng.integers(0, 4))]


def _generate_portfolio() -> list[Loan]:
    model = get_model()
    borrowers = generate_borrowers(PORTFOLIO_SIZE, SEED)
    rng = np.random.default_rng(SEED + 7)

    today = date(2026, 8, 21)
    loans: list[Loan] = []
    for i, row in borrowers.iterrows():
        borrower = row.to_dict()
        pd_value = model.predict_pd(borrower)
        score = pd_to_score(pd_value)
        tier = tier_from_score(score)
        lgd = estimate_lgd(borrower["credit_utilization"])
        amount = float(borrower["loan_amount"])
        expected_loss = round(amount * pd_value * lgd, 2)
        scored_at = today - timedelta(days=int(rng.integers(0, 45)))

        loans.append(
            Loan(
                id=f"LN-{10428 + i * 7}",
                applicant=f"APP-{48210 + i * 13}",
                amount=amount,
                interest_rate=float(borrower["interest_rate"]),
                term_months=int([24, 36, 48, 60, 84][int(rng.integers(0, 5))]),
                risk_score=score,
                pd=round(pd_value, 4),
                lgd=lgd,
                expected_loss=expected_loss,
                tier=tier,  # type: ignore[arg-type]
                status=_pick_status(tier, rng),  # type: ignore[arg-type]
                scored_at=scored_at.isoformat(),
            )
        )
    return loans


@lru_cache(maxsize=1)
def get_portfolio() -> list[Loan]:
    return _generate_portfolio()


@lru_cache(maxsize=1)
def get_portfolio_features() -> pd.DataFrame:
    """The raw borrower feature rows behind the scored portfolio, in the
    same row order as get_portfolio() - used by the stress-test endpoint to
    re-score the whole book under shocked assumptions."""
    return generate_borrowers(PORTFOLIO_SIZE, SEED)


def get_summary() -> PortfolioSummary:
    loans = get_portfolio()
    portfolio_value = sum(l.amount for l in loans)
    total_expected_loss = sum(l.expected_loss for l in loans)
    avg_risk_score = sum(l.risk_score for l in loans) / len(loans)
    overall_default_rate = sum(l.pd * l.amount for l in loans) / portfolio_value
    return PortfolioSummary(
        portfolio_value=round(portfolio_value, 2),
        overall_default_rate=round(overall_default_rate, 4),
        total_expected_loss=round(total_expected_loss, 2),
        avg_risk_score=round(avg_risk_score, 1),
    )


def get_tier_breakdown() -> list[TierBreakdownRow]:
    loans = get_portfolio()
    rows = []
    for tier in TIER_ORDER:
        subset = [l for l in loans if l.tier == tier]
        expected_loss = sum(l.expected_loss for l in subset)
        rows.append(
            TierBreakdownRow(
                tier=tier,  # type: ignore[arg-type]
                count=len(subset),
                exposure=round(sum(l.amount for l in subset), 2),
                expected_loss=round(expected_loss, 2),
                # Unexpected loss approximated as a multiple of expected
                # loss (a common simplification of the Basel UL formula
                # when a full asset-correlation model isn't in scope).
                unexpected_loss=round(expected_loss * 1.9, 2),
            )
        )
    return rows


def get_trend() -> list[TrendPoint]:
    """Aggregate the scored book into a trailing-12-month default rate
    trend. The portfolio itself doesn't carry 12 months of real history in
    this demo, so month-over-month drift is simulated around the book's
    actual model-implied default rate - replace with a real time-series
    query once loans are scored longitudinally."""
    loans = get_portfolio()
    base_rate = sum(l.pd * l.amount for l in loans) / sum(l.amount for l in loans)
    rng = np.random.default_rng(SEED + 11)

    months = pd.period_range(end="2026-08", periods=12, freq="M")
    trend = []
    drift = np.linspace(-0.35, 0.15, 12) * base_rate  # mild upward drift into the current month
    cum_portfolio = 11.2
    for i, m in enumerate(months):
        rate = max(0.1, (base_rate + drift[i]) * 100 + rng.normal(0, 0.08))
        forecast = max(0.1, (base_rate + drift[i]) * 100 * 0.97)
        cum_portfolio += rng.uniform(0.3, 0.7)
        trend.append(
            TrendPoint(
                month=m.strftime("%b %y"),
                rate=round(float(rate), 2),
                forecast=round(float(forecast), 2),
                portfolio=round(float(cum_portfolio), 1),
            )
        )
    return trend


def get_recent_applications(limit: int = 8) -> list[Loan]:
    loans = sorted(get_portfolio(), key=lambda l: l.scored_at, reverse=True)
    return loans[:limit]
