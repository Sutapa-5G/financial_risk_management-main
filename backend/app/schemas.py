from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

RiskTier = Literal["Low", "Medium", "High", "Critical"]
LoanStatus = Literal["Approved", "Pending", "Declined", "Current", "Delinquent"]


class CamelModel(BaseModel):
    """Base model that serializes fields as camelCase, matching the existing
    TypeScript interfaces in src/data/portfolio.ts and src/lib/scoring.ts
    exactly, so the frontend needs no field-name changes."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---- Borrower scoring ------------------------------------------------------


class BorrowerInput(CamelModel):
    income: float = Field(gt=0)
    loan_amount: float = Field(gt=0)
    credit_utilization: float = Field(ge=0, le=100)
    dti: float = Field(ge=0, le=100)
    credit_history: float = Field(ge=0, le=60)
    open_accounts: float = Field(ge=0, le=60)
    employment_length: float = Field(ge=0, le=60)
    interest_rate: float | None = Field(default=None, ge=0, le=40)


class Contribution(CamelModel):
    label: str
    value: float


class ScoreResult(CamelModel):
    pd: float
    score: int
    tier: RiskTier
    lgd: float
    expected_loss: float
    contributions: list[Contribution]


# ---- Portfolio --------------------------------------------------------------


class Loan(CamelModel):
    id: str
    applicant: str
    amount: float
    interest_rate: float
    term_months: int
    risk_score: int
    pd: float
    lgd: float
    expected_loss: float
    tier: RiskTier
    status: LoanStatus
    scored_at: str


class PaginatedLoans(CamelModel):
    items: list[Loan]
    total: int
    page: int
    page_size: int


class PortfolioSummary(CamelModel):
    portfolio_value: float
    overall_default_rate: float
    total_expected_loss: float
    avg_risk_score: float


class TrendPoint(CamelModel):
    month: str
    rate: float
    forecast: float
    portfolio: float


class TierBreakdownRow(CamelModel):
    tier: RiskTier
    count: int
    exposure: float
    expected_loss: float
    unexpected_loss: float


# ---- Model performance -------------------------------------------------------


class MetricRow(CamelModel):
    name: str
    value: float
    delta: float | None = None
    hint: str | None = None


class RocPoint(CamelModel):
    fpr: float
    tpr: float
    baseline: float


class ConfusionMatrix(CamelModel):
    true_positive: int
    false_positive: int
    false_negative: int
    true_negative: int


class CalibrationPoint(CamelModel):
    decile: str
    predicted: float
    actual: float


# ---- Stress test --------------------------------------------------------------


class StressTestRequest(CamelModel):
    unemployment_shock: float = Field(ge=-5, le=15, description="Percentage points")
    interest_rate_shock: float = Field(ge=-5, le=15, description="Percentage points")


class StressTestResult(CamelModel):
    baseline_default_rate: float
    stressed_default_rate: float
    baseline_expected_loss: float
    stressed_expected_loss: float
    delta_expected_loss: float
