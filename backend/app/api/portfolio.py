from __future__ import annotations

from fastapi import APIRouter, Query

from app.data_store.portfolio_store import (
    get_portfolio,
    get_recent_applications,
    get_summary,
    get_tier_breakdown,
    get_trend,
)
from app.schemas import (
    Loan,
    PaginatedLoans,
    PortfolioSummary,
    TierBreakdownRow,
    TrendPoint,
)

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/summary", response_model=PortfolioSummary, response_model_by_alias=True)
def summary() -> PortfolioSummary:
    return get_summary()


@router.get("/trend", response_model=list[TrendPoint], response_model_by_alias=True)
def trend() -> list[TrendPoint]:
    return get_trend()


@router.get("/tier-breakdown", response_model=list[TierBreakdownRow], response_model_by_alias=True)
def tier_breakdown() -> list[TierBreakdownRow]:
    return get_tier_breakdown()


@router.get("/recent", response_model=list[Loan], response_model_by_alias=True)
def recent(limit: int = Query(default=8, ge=1, le=50)) -> list[Loan]:
    return get_recent_applications(limit)


@router.get("/loans", response_model=PaginatedLoans, response_model_by_alias=True)
def loans(
    tier: str | None = None,
    status: str | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    sort_by: str = "scoredAt",
    sort_dir: str = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
) -> PaginatedLoans:
    rows = get_portfolio()

    if tier:
        rows = [l for l in rows if l.tier == tier]
    if status:
        rows = [l for l in rows if l.status == status]
    if min_amount is not None:
        rows = [l for l in rows if l.amount >= min_amount]
    if max_amount is not None:
        rows = [l for l in rows if l.amount <= max_amount]

    sort_key_map = {
        "id": lambda l: l.id,
        "amount": lambda l: l.amount,
        "interestRate": lambda l: l.interest_rate,
        "termMonths": lambda l: l.term_months,
        "riskScore": lambda l: l.risk_score,
        "pd": lambda l: l.pd,
        "lgd": lambda l: l.lgd,
        "expectedLoss": lambda l: l.expected_loss,
        "scoredAt": lambda l: l.scored_at,
    }
    key_fn = sort_key_map.get(sort_by, sort_key_map["scoredAt"])
    rows = sorted(rows, key=key_fn, reverse=(sort_dir == "desc"))

    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start : start + page_size]

    return PaginatedLoans(items=page_rows, total=total, page=page, page_size=page_size)
