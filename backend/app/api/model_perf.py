from __future__ import annotations

from fastapi import APIRouter

from app.ml.model import get_model
from app.schemas import CalibrationPoint, ConfusionMatrix, MetricRow, RocPoint

router = APIRouter(prefix="/api/model", tags=["model-performance"])

_HINTS = {
    "AUC-ROC": "Discrimination on hold-out set",
    "Precision": "At the model's Youden-J decision threshold",
    "Recall": "Captured true defaults",
    "F1 Score": "Harmonic mean",
    "KS Statistic": "Max cumulative separation",
}


@router.get("/metrics", response_model=list[MetricRow], response_model_by_alias=True)
def metrics() -> list[MetricRow]:
    data = get_model().metrics
    return [MetricRow(name=m["name"], value=m["value"], hint=_HINTS.get(m["name"])) for m in data["metrics"]]


@router.get("/roc-curve", response_model=list[RocPoint], response_model_by_alias=True)
def roc_curve() -> list[RocPoint]:
    return [RocPoint(**p) for p in get_model().metrics["roc_curve"]]


@router.get("/confusion-matrix", response_model=ConfusionMatrix, response_model_by_alias=True)
def confusion_matrix() -> ConfusionMatrix:
    cm = get_model().metrics["confusion_matrix"]
    return ConfusionMatrix(**cm)


@router.get("/calibration", response_model=list[CalibrationPoint], response_model_by_alias=True)
def calibration() -> list[CalibrationPoint]:
    return [CalibrationPoint(**p) for p in get_model().metrics["calibration"]]


@router.get("/summary")
def summary() -> dict:
    """Extra context not in the original mock data - which model is
    deployed, how it compares to the logistic baseline, and the chosen
    decision threshold. Handy for a 'model card' style panel."""
    m = get_model().metrics
    return {
        "productionModel": m["production_model"],
        "productionModelNote": m["production_model_note"],
        "baselineModel": m["baseline_model"],
        "baselineAucRoc": m["baseline_auc_roc"],
        "decisionThreshold": m["decision_threshold"],
        "testSetSize": m["test_set_size"],
        "testSetDefaultRate": m["test_set_default_rate"],
    }
