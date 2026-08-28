import type { Loan, RiskTier, LoanStatus } from "@/data/portfolio";
import type { BorrowerInput, Contribution, ScoreResult } from "@/lib/scoring";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(
      `Could not reach the Risk Navigator API at ${API_BASE}. Is the backend running (uvicorn app.main:app --port 8000)?`,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(`${path} failed (${res.status}): ${body.slice(0, 200)}`, res.status);
  }
  return res.json() as Promise<T>;
}

// ---- Portfolio ---------------------------------------------------------

export interface PortfolioSummary {
  portfolioValue: number;
  overallDefaultRate: number;
  totalExpectedLoss: number;
  avgRiskScore: number;
}

export interface TrendPoint {
  month: string;
  rate: number;
  forecast: number;
  portfolio: number;
}

export interface TierBreakdownRow {
  tier: RiskTier;
  count: number;
  exposure: number;
  expectedLoss: number;
  unexpectedLoss: number;
}

export interface PaginatedLoans {
  items: Loan[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LoanFilters {
  tier?: RiskTier | "All";
  status?: LoanStatus | "All";
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function getPortfolioSummary() {
  return request<PortfolioSummary>("/api/portfolio/summary");
}

export function getPortfolioTrend() {
  return request<TrendPoint[]>("/api/portfolio/trend");
}

export function getTierBreakdown() {
  return request<TierBreakdownRow[]>("/api/portfolio/tier-breakdown");
}

export function getRecentApplications(limit = 8) {
  return request<Loan[]>(`/api/portfolio/recent?limit=${limit}`);
}

export function getLoans(filters: LoanFilters = {}) {
  const params = new URLSearchParams();
  if (filters.tier && filters.tier !== "All") params.set("tier", filters.tier);
  if (filters.status && filters.status !== "All") params.set("status", filters.status);
  if (filters.minAmount != null) params.set("min_amount", String(filters.minAmount));
  if (filters.maxAmount != null) params.set("max_amount", String(filters.maxAmount));
  if (filters.sortBy) params.set("sort_by", filters.sortBy);
  if (filters.sortDir) params.set("sort_dir", filters.sortDir);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 250));
  return request<PaginatedLoans>(`/api/portfolio/loans?${params.toString()}`);
}

// ---- Scoring -------------------------------------------------------------

export function scoreBorrowerApi(input: BorrowerInput) {
  return request<ScoreResult>("/api/score", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---- Stress test -----------------------------------------------------------

export interface StressTestRequest {
  unemploymentShock: number;
  interestRateShock: number;
}

export interface StressTestResult {
  baselineDefaultRate: number;
  stressedDefaultRate: number;
  baselineExpectedLoss: number;
  stressedExpectedLoss: number;
  deltaExpectedLoss: number;
}

export function runStressTest(payload: StressTestRequest) {
  return request<StressTestResult>("/api/stress-test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- Model performance -------------------------------------------------------

export interface MetricRow {
  name: string;
  value: number;
  delta?: number | null;
  hint?: string | null;
}

export interface RocPoint {
  fpr: number;
  tpr: number;
  baseline: number;
}

export interface ConfusionMatrix {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
}

export interface CalibrationPoint {
  decile: string;
  predicted: number;
  actual: number;
}

export interface ModelSummary {
  productionModel: string;
  productionModelNote: string;
  baselineModel: string;
  baselineAucRoc: number;
  decisionThreshold: number;
  testSetSize: number;
  testSetDefaultRate: number;
}

export function getModelMetrics() {
  return request<MetricRow[]>("/api/model/metrics");
}

export function getRocCurve() {
  return request<RocPoint[]>("/api/model/roc-curve");
}

export function getConfusionMatrix() {
  return request<ConfusionMatrix>("/api/model/confusion-matrix");
}

export function getCalibration() {
  return request<CalibrationPoint[]>("/api/model/calibration");
}

export function getModelSummary() {
  return request<ModelSummary>("/api/model/summary");
}

export type { Contribution };
