import { tierFromScore, type RiskTier } from "@/data/portfolio";

export interface BorrowerInput {
  income: number;
  loanAmount: number;
  creditUtilization: number;
  dti: number;
  creditHistory: number;
  openAccounts: number;
  employmentLength: number;
}

export interface Contribution {
  label: string;
  value: number; // log-odds style contribution; positive pushes risk up
}

export interface ScoreResult {
  pd: number;
  score: number;
  tier: RiskTier;
  lgd: number;
  expectedLoss: number;
  contributions: Contribution[];
}

/** Transparent mock scorecard — replace with a real model call later. */
export function scoreBorrower(i: BorrowerInput): ScoreResult {
  const loanToIncome = i.income > 0 ? i.loanAmount / i.income : 4;

  const contributions: Contribution[] = [
    { label: "Credit Utilization", value: (i.creditUtilization - 35) * 0.022 },
    { label: "Debt-to-Income", value: (i.dti - 28) * 0.026 },
    { label: "Loan / Income Ratio", value: (loanToIncome - 0.9) * 0.42 },
    { label: "Annual Income", value: -((i.income - 62000) / 62000) * 0.55 },
    { label: "Credit History Length", value: -(i.creditHistory - 7) * 0.07 },
    { label: "Employment Length", value: -(i.employmentLength - 5) * 0.06 },
    { label: "Open Accounts", value: (i.openAccounts - 6) * 0.045 },
  ].map((c) => ({ ...c, value: Number(c.value.toFixed(3)) }));

  const logit = -1.55 + contributions.reduce((s, c) => s + c.value, 0);
  const pd = Math.min(0.97, Math.max(0.004, 1 / (1 + Math.exp(-logit))));
  const score = Math.round(Math.min(99, Math.max(1, Math.pow(pd, 0.55) * 128)));
  const lgd = Number(Math.min(0.75, 0.32 + i.creditUtilization / 320).toFixed(2));

  return {
    pd,
    score,
    tier: tierFromScore(score),
    lgd,
    expectedLoss: Math.round(i.loanAmount * pd * lgd),
    contributions: contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
  };
}

export const DEFAULT_BORROWER: BorrowerInput = {
  income: 72000,
  loanAmount: 48000,
  creditUtilization: 46,
  dti: 31,
  creditHistory: 6,
  openAccounts: 7,
  employmentLength: 4,
};
