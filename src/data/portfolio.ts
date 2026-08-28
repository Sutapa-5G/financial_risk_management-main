/**
 * Mock data layer.
 * Everything here is deterministic pseudo-random data shaped like the
 * responses a real risk API would return. Swap these constants for fetches.
 */

export type RiskTier = "Low" | "Medium" | "High" | "Critical";
export type LoanStatus = "Approved" | "Pending" | "Declined" | "Current" | "Delinquent";

export interface Loan {
  id: string;
  applicant: string;
  amount: number;
  interestRate: number;
  termMonths: number;
  riskScore: number;
  pd: number;
  lgd: number;
  expectedLoss: number;
  tier: RiskTier;
  status: LoanStatus;
  scoredAt: string;
}

export function tierFromScore(score: number): RiskTier {
  if (score < 30) return "Low";
  if (score < 55) return "Medium";
  if (score < 78) return "High";
  return "Critical";
}

// Deterministic LCG so mock data never shifts between renders.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const STATUSES: LoanStatus[] = ["Approved", "Pending", "Declined", "Current", "Delinquent"];

function buildLoans(count: number): Loan[] {
  const r = rng(20240817);
  const loans: Loan[] = [];
  for (let i = 0; i < count; i++) {
    const score = Math.round(4 + r() * 92);
    const tier = tierFromScore(score);
    const amount = Math.round((5000 + r() * 295000) / 500) * 500;
    const pd = Number((0.003 + Math.pow(score / 100, 2.6) * 0.26 + r() * 0.008).toFixed(4));
    const lgd = Number((0.28 + r() * 0.42).toFixed(2));
    const status: LoanStatus =
      tier === "Critical" && r() > 0.45
        ? r() > 0.5
          ? "Declined"
          : "Delinquent"
        : STATUSES[Math.floor(r() * 4)]!;
    const day = String(1 + Math.floor(r() * 28)).padStart(2, "0");
    loans.push({
      id: `LN-${(10428 + i * 7).toString()}`,
      applicant: `APP-${(48210 + i * 13).toString()}`,
      amount,
      interestRate: Number((4.2 + (score / 100) * 14 + r() * 1.4).toFixed(2)),
      termMonths: [24, 36, 48, 60, 84][Math.floor(r() * 5)]!,
      riskScore: score,
      pd,
      lgd,
      expectedLoss: Math.round(amount * pd * lgd),
      tier,
      status,
      scoredAt: `2026-08-${day}`,
    });
  }
  return loans;
}

export const LOANS: Loan[] = buildLoans(52);

export const RECENT_APPLICATIONS: Loan[] = [...LOANS]
  .sort((a, b) => b.scoredAt.localeCompare(a.scoredAt))
  .slice(0, 8);

export const PORTFOLIO_VALUE = LOANS.reduce((sum, l) => sum + l.amount, 0);
export const TOTAL_EXPECTED_LOSS = LOANS.reduce((sum, l) => sum + l.expectedLoss, 0);
export const AVG_RISK_SCORE =
  LOANS.reduce((sum, l) => sum + l.riskScore, 0) / LOANS.length;
export const OVERALL_PD =
  LOANS.reduce((sum, l) => sum + l.pd * l.amount, 0) / PORTFOLIO_VALUE;

export const DEFAULT_RATE_TREND = [
  { month: "Sep 25", rate: 2.41, forecast: 2.5, portfolio: 11.2 },
  { month: "Oct 25", rate: 2.58, forecast: 2.55, portfolio: 11.6 },
  { month: "Nov 25", rate: 2.72, forecast: 2.64, portfolio: 12.1 },
  { month: "Dec 25", rate: 3.14, forecast: 2.83, portfolio: 12.4 },
  { month: "Jan 26", rate: 3.02, forecast: 2.95, portfolio: 12.9 },
  { month: "Feb 26", rate: 2.88, forecast: 2.9, portfolio: 13.4 },
  { month: "Mar 26", rate: 3.31, forecast: 3.05, portfolio: 13.8 },
  { month: "Apr 26", rate: 3.62, forecast: 3.34, portfolio: 14.1 },
  { month: "May 26", rate: 3.48, forecast: 3.5, portfolio: 14.6 },
  { month: "Jun 26", rate: 3.77, forecast: 3.62, portfolio: 15.2 },
  { month: "Jul 26", rate: 4.05, forecast: 3.81, portfolio: 15.7 },
  { month: "Aug 26", rate: 3.94, forecast: 3.98, portfolio: 16.3 },
];

export const TIER_ORDER: RiskTier[] = ["Low", "Medium", "High", "Critical"];

export const TIER_BREAKDOWN = TIER_ORDER.map((tier) => {
  const rows = LOANS.filter((l) => l.tier === tier);
  return {
    tier,
    count: rows.length,
    exposure: rows.reduce((s, l) => s + l.amount, 0),
    expectedLoss: rows.reduce((s, l) => s + l.expectedLoss, 0),
    unexpectedLoss: Math.round(rows.reduce((s, l) => s + l.expectedLoss, 0) * 1.9),
  };
});

export const MODEL_METRICS = [
  { name: "AUC-ROC", value: 0.874, delta: 0.006, hint: "Discrimination on hold-out set" },
  { name: "Precision", value: 0.781, delta: -0.004, hint: "At 0.35 decision threshold" },
  { name: "Recall", value: 0.723, delta: 0.011, hint: "Captured true defaults" },
  { name: "F1 Score", value: 0.751, delta: 0.003, hint: "Harmonic mean" },
  { name: "KS Statistic", value: 0.602, delta: 0.008, hint: "Max cumulative separation" },
];

export const ROC_CURVE = [
  { fpr: 0, tpr: 0 },
  { fpr: 0.02, tpr: 0.19 },
  { fpr: 0.05, tpr: 0.34 },
  { fpr: 0.09, tpr: 0.48 },
  { fpr: 0.14, tpr: 0.6 },
  { fpr: 0.2, tpr: 0.69 },
  { fpr: 0.28, tpr: 0.77 },
  { fpr: 0.37, tpr: 0.83 },
  { fpr: 0.48, tpr: 0.88 },
  { fpr: 0.61, tpr: 0.92 },
  { fpr: 0.75, tpr: 0.96 },
  { fpr: 0.88, tpr: 0.98 },
  { fpr: 1, tpr: 1 },
].map((p) => ({ ...p, baseline: p.fpr }));

export const CONFUSION_MATRIX = {
  truePositive: 1284,
  falsePositive: 359,
  falseNegative: 492,
  trueNegative: 9865,
};

export const CALIBRATION = Array.from({ length: 10 }, (_, i) => {
  const predicted = Number((0.9 + i * 1.15 + i * i * 0.16).toFixed(2));
  const drift = [0.1, -0.2, 0.15, 0.35, -0.4, 0.28, 0.5, -0.6, 0.72, -0.9][i]!;
  return {
    decile: `D${i + 1}`,
    predicted,
    actual: Number(Math.max(0.2, predicted + drift).toFixed(2)),
  };
});

export const FEATURE_CATALOG = [
  { key: "creditUtilization", label: "Credit Utilization", weight: 0.26 },
  { key: "dti", label: "Debt-to-Income", weight: 0.22 },
  { key: "income", label: "Annual Income", weight: -0.18 },
  { key: "creditHistory", label: "Credit History Length", weight: -0.14 },
  { key: "loanAmount", label: "Loan Amount", weight: 0.11 },
  { key: "openAccounts", label: "Open Accounts", weight: 0.05 },
  { key: "employmentLength", label: "Employment Length", weight: -0.09 },
] as const;
