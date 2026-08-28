"""
Train the probability-of-default (PD) model and write all artifacts the API
needs at runtime: the fitted model, evaluation metrics, ROC points, the
confusion matrix, and a calibration table.

Run with:  python -m app.ml.train
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from app.ml.dataset import FEATURE_COLUMNS, MONOTONIC_CONSTRAINTS, build_training_frame

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"


def youden_threshold(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """Pick the operating threshold that maximizes tpr - fpr (Youden's J).
    With a low base default rate, a fixed 0.5 (or even 0.35) threshold
    almost never fires - this adapts to the actual class balance instead."""
    fpr, tpr, thresh = roc_curve(y_true, y_prob)
    j = tpr - fpr
    return float(thresh[np.argmax(j)])


def ks_statistic(y_true: np.ndarray, y_score: np.ndarray) -> float:
    """Kolmogorov-Smirnov statistic: max separation between the cumulative
    good-account and bad-account distributions across score thresholds."""
    order = np.argsort(y_score)
    y_true_sorted = y_true[order]
    n_bad = y_true_sorted.sum()
    n_good = len(y_true_sorted) - n_bad
    cum_bad = np.cumsum(y_true_sorted) / max(n_bad, 1)
    cum_good = np.cumsum(1 - y_true_sorted) / max(n_good, 1)
    return float(np.max(np.abs(cum_bad - cum_good)))


def downsample_roc(fpr: np.ndarray, tpr: np.ndarray, points: int = 14) -> list[dict]:
    idx = np.unique(np.round(np.linspace(0, len(fpr) - 1, points)).astype(int))
    return [
        {"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4), "baseline": round(float(fpr[i]), 4)}
        for i in idx
    ]


def calibration_table(y_true: np.ndarray, y_prob: np.ndarray, deciles: int = 10) -> list[dict]:
    df = pd.DataFrame({"y": y_true, "p": y_prob})
    df["decile"] = pd.qcut(df["p"], deciles, labels=False, duplicates="drop")
    rows = []
    for d, grp in df.groupby("decile"):
        rows.append(
            {
                "decile": f"D{int(d) + 1}",
                "predicted": round(float(grp["p"].mean()) * 100, 2),
                "actual": round(float(grp["y"].mean()) * 100, 2),
            }
        )
    return rows


def train() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    frame = build_training_frame()
    X = frame[FEATURE_COLUMNS]
    y = frame["default"].to_numpy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    monotonic = [MONOTONIC_CONSTRAINTS[c] for c in FEATURE_COLUMNS]
    model = HistGradientBoostingClassifier(
        max_depth=5,
        max_leaf_nodes=31,
        max_iter=400,
        learning_rate=0.05,
        l2_regularization=0.15,
        min_samples_leaf=40,
        monotonic_cst=monotonic,
        early_stopping=True,
        validation_fraction=0.15,
        n_iter_no_change=20,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # Logistic-regression baseline, purely for a "champion vs. challenger"
    # comparison in the metrics artifact - common practice in a risk-model
    # writeup and cheap to compute.
    scaler = StandardScaler().fit(X_train)
    baseline = LogisticRegression(max_iter=1000).fit(scaler.transform(X_train), y_train)
    baseline_auc = roc_auc_score(y_test, baseline.predict_proba(scaler.transform(X_test))[:, 1])

    y_prob = model.predict_proba(X_test)[:, 1]
    decision_threshold = youden_threshold(y_test, y_prob)
    y_pred = (y_prob >= decision_threshold).astype(int)

    auc = roc_auc_score(y_test, y_prob)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    ks = ks_statistic(y_test.to_numpy() if hasattr(y_test, "to_numpy") else y_test, y_prob)

    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()

    fpr, tpr, _ = roc_curve(y_test, y_prob)

    metrics = {
        "decision_threshold": round(decision_threshold, 4),
        "test_set_size": int(len(y_test)),
        "test_set_default_rate": round(float(np.mean(y_test)), 4),
        "production_model": "HistGradientBoostingClassifier",
        "production_model_note": (
            "Deployed model is a monotonic-constrained gradient-boosted tree, "
            "chosen for feature-level SHAP explainability and enforceable "
            "monotonic risk relationships, even though its AUC is close to "
            "(and on some splits slightly below) the logistic baseline."
        ),
        "baseline_model": "LogisticRegression",
        "baseline_auc_roc": round(float(baseline_auc), 4),
        "metrics": [
            {"name": "AUC-ROC", "value": round(float(auc), 4)},
            {"name": "Precision", "value": round(float(precision), 4)},
            {"name": "Recall", "value": round(float(recall), 4)},
            {"name": "F1 Score", "value": round(float(f1), 4)},
            {"name": "KS Statistic", "value": round(float(ks), 4)},
        ],
        "confusion_matrix": {
            "truePositive": int(tp),
            "falsePositive": int(fp),
            "falseNegative": int(fn),
            "trueNegative": int(tn),
        },
        "roc_curve": downsample_roc(fpr, tpr),
        "calibration": calibration_table(y_test.to_numpy() if hasattr(y_test, "to_numpy") else y_test, y_prob),
    }

    joblib.dump(model, ARTIFACTS_DIR / "pd_model.joblib")
    # Small background sample for the SHAP explainer at inference time.
    background = X_train.sample(n=min(200, len(X_train)), random_state=42)
    joblib.dump(background, ARTIFACTS_DIR / "shap_background.joblib")
    (ARTIFACTS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))

    print(f"AUC-ROC: {auc:.4f}  (baseline logistic: {baseline_auc:.4f})")
    print(f"Precision/Recall/F1 @ {decision_threshold:.3f}: {precision:.3f} / {recall:.3f} / {f1:.3f}")
    print(f"KS statistic: {ks:.4f}")
    print(f"Artifacts written to {ARTIFACTS_DIR}")


if __name__ == "__main__":
    train()
