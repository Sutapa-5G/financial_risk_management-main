"""
Synthetic credit-risk dataset generator.

No public credit-risk dataset is bundled with this project, so we generate a
large synthetic borrower population with realistic feature distributions and
a *ground-truth* default process wired through non-linear interactions and
noise. This is standard practice when prototyping a credit risk model without
access to a licensed bureau dataset (e.g. Lending Club / Home Credit) - swap
`generate_borrowers` for a real data loader (see README) once you have one.

The default label is generated independently of the model that will later be
trained on it, so the trained model has to genuinely learn the relationship
instead of memorizing a formula - AUC will land in a realistic ~0.80-0.90
range rather than a suspicious ~0.99.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "income",
    "loan_amount",
    "credit_utilization",
    "dti",
    "credit_history",
    "open_accounts",
    "employment_length",
    "interest_rate",
]

# Monotonic constraint direction for each feature, used by the HistGBM model:
# +1 => increasing the feature should not decrease predicted risk
# -1 => increasing the feature should not increase predicted risk
MONOTONIC_CONSTRAINTS = {
    "income": -1,
    "loan_amount": 1,
    "credit_utilization": 1,
    "dti": 1,
    "credit_history": -1,
    "open_accounts": 1,
    "employment_length": -1,
    "interest_rate": 1,
}


def generate_borrowers(n: int, seed: int) -> pd.DataFrame:
    """Generate n synthetic borrower feature rows (no label)."""
    rng = np.random.default_rng(seed)

    income = np.clip(rng.lognormal(mean=11.0, sigma=0.45, size=n), 18_000, 320_000)
    loan_amount = np.clip(rng.lognormal(mean=10.2, sigma=0.55, size=n), 3_000, 320_000)
    credit_utilization = np.clip(rng.beta(2.1, 3.0, size=n) * 100, 0, 100)
    dti = np.clip(rng.beta(2.3, 3.4, size=n) * 70, 0, 75)
    credit_history = np.clip(rng.gamma(shape=2.4, scale=3.1, size=n), 0, 35)
    open_accounts = np.clip(rng.poisson(lam=6.2, size=n), 0, 24).astype(float)
    employment_length = np.clip(rng.gamma(shape=1.8, scale=3.0, size=n), 0, 30)
    # Base rate priced mostly off macro spread + a little borrower-observable
    # risk signal (as a real pricing desk would use utilization/DTI at
    # origination) - deliberately NOT derived from the hidden default draw.
    base_spread = rng.normal(4.5, 1.1, size=n)
    interest_rate = np.clip(
        base_spread + credit_utilization * 0.035 + dti * 0.025 + rng.normal(0, 0.6, size=n),
        3.5,
        29.9,
    )

    return pd.DataFrame(
        {
            "income": np.round(income, 0),
            "loan_amount": np.round(loan_amount / 500) * 500,
            "credit_utilization": np.round(credit_utilization, 1),
            "dti": np.round(dti, 1),
            "credit_history": np.round(credit_history, 1),
            "open_accounts": open_accounts,
            "employment_length": np.round(employment_length, 1),
            "interest_rate": np.round(interest_rate, 2),
        }
    )


def simulate_defaults(df: pd.DataFrame, seed: int) -> np.ndarray:
    """
    Draw a ground-truth default label for each row from a latent risk
    process. This intentionally uses different functional form / noise than
    anything the model sees at feature-engineering time, so the learning
    problem isn't trivial.
    """
    rng = np.random.default_rng(seed + 1)
    n = len(df)

    loan_to_income = df["loan_amount"] / df["income"].clip(lower=1_000)

    z = (
        -3.35
        + 0.031 * (df["credit_utilization"] - 35)
        + 0.048 * (df["dti"] - 28)
        + 0.72 * (loan_to_income - 0.9)
        - 0.62 * ((df["income"] - 62_000) / 62_000)
        - 0.075 * (df["credit_history"] - 7)
        - 0.065 * (df["employment_length"] - 5)
        + 0.05 * (df["open_accounts"] - 6)
        + 0.085 * (df["interest_rate"] - 11)
        # non-linear interaction terms a plain linear model can't capture,
        # so a boosted tree has genuine headroom over the logistic baseline
        + 0.00075 * (df["credit_utilization"] * df["dti"] - 35 * 28) / 10
        - 0.11 * np.minimum(df["credit_history"], 12) * (df["employment_length"] > 8)
        + 0.09 * (df["credit_utilization"] > 75) * (df["dti"] > 40)
        - 0.06 * (df["income"] > 90_000) * (df["credit_history"] > 10)
    )
    z += rng.normal(0, 0.5, size=n)  # idiosyncratic noise the model can't explain
    p = 1 / (1 + np.exp(-z))
    return rng.binomial(1, p)


def build_training_frame(n: int = 24_000, seed: int = 20260817) -> pd.DataFrame:
    df = generate_borrowers(n, seed)
    df["default"] = simulate_defaults(df, seed)
    return df
