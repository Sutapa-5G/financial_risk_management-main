from __future__ import annotations

from fastapi import APIRouter

from app.ml.model import estimate_lgd, get_model, pd_to_score, tier_from_score
from app.schemas import BorrowerInput, ScoreResult

router = APIRouter(prefix="/api/score", tags=["scoring"])

# Reasonable default when a caller doesn't supply an interest rate (the
# original UI form doesn't collect one) - priced off utilization/DTI the
# same way the training data's rates were generated.
def _default_interest_rate(b: BorrowerInput) -> float:
    return round(4.5 + b.credit_utilization * 0.035 + b.dti * 0.025, 2)


@router.post("", response_model=ScoreResult, response_model_by_alias=True)
def score_borrower(borrower: BorrowerInput) -> ScoreResult:
    model = get_model()
    payload = borrower.model_dump()
    if payload.get("interest_rate") is None:
        payload["interest_rate"] = _default_interest_rate(borrower)

    pd_value = model.predict_pd(payload)
    score = pd_to_score(pd_value)
    tier = tier_from_score(score)
    lgd = estimate_lgd(borrower.credit_utilization)
    expected_loss = round(borrower.loan_amount * pd_value * lgd, 2)
    contributions = model.explain(payload)

    return ScoreResult(
        pd=round(pd_value, 4),
        score=score,
        tier=tier,  # type: ignore[arg-type]
        lgd=lgd,
        expected_loss=expected_loss,
        contributions=contributions,
    )
