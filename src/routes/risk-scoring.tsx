import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/risk/AppShell";
import {
  PageHeader,
  Panel,
  QueryState,
  TIER_HEX,
  TierBadge,
  chartAxis,
  tooltipStyle,
} from "@/components/risk/primitives";
import { DEFAULT_BORROWER, type BorrowerInput } from "@/lib/scoring";
import { scoreBorrowerApi } from "@/lib/api";
import { pct, inr } from "@/lib/format";

export const Route = createFileRoute("/risk-scoring")({
  head: () => ({
    meta: [
      { title: "Risk Scoring — RiskLens Credit Risk Engine" },
      {
        name: "description",
        content:
          "Score an individual borrower: probability of default, risk tier, expected loss and per-feature contribution attribution.",
      },
      { property: "og:title", content: "Risk Scoring — RiskLens Credit Risk Engine" },
      {
        property: "og:description",
        content:
          "Enter borrower attributes and get a probability of default with feature-level attribution.",
      },
    ],
  }),
  component: RiskScoring,
});

const FIELDS: { key: keyof BorrowerInput; label: string; suffix?: string; step: number }[] = [
  { key: "income", label: "Annual Income", suffix: "INR", step: 1000 },
  { key: "loanAmount", label: "Loan Amount", suffix: "INR", step: 500 },
  { key: "creditUtilization", label: "Credit Utilization", suffix: "%", step: 1 },
  { key: "dti", label: "Debt-to-Income Ratio", suffix: "%", step: 1 },
  { key: "creditHistory", label: "Credit History Length", suffix: "yrs", step: 1 },
  { key: "openAccounts", label: "Open Accounts", suffix: "count", step: 1 },
  { key: "employmentLength", label: "Employment Length", suffix: "yrs", step: 1 },
];

function Gauge({ pd, tier }: { pd: number; tier: keyof typeof TIER_HEX }) {
  const r = 78;
  const circumference = Math.PI * r;
  const filled = Math.min(1, pd / 0.6) * circumference;
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[280px]">
        <path
          d="M 22 104 A 78 78 0 0 1 178 104"
          fill="none"
          stroke="oklch(1 0 0 / 9%)"
          strokeWidth={13}
          strokeLinecap="round"
        />
        <path
          d="M 22 104 A 78 78 0 0 1 178 104"
          fill="none"
          stroke={TIER_HEX[tier]}
          strokeWidth={13}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="num text-4xl font-semibold" style={{ color: TIER_HEX[tier] }}>
          {(pd * 100).toFixed(2)}%
        </p>
        <p className="label-xs mt-1">Probability of Default</p>
      </div>
    </div>
  );
}

function RiskScoring() {
  const [draft, setDraft] = useState<BorrowerInput>(DEFAULT_BORROWER);
  const [submitted, setSubmitted] = useState<BorrowerInput>(DEFAULT_BORROWER);

  const scoreM = useMutation({
    mutationFn: scoreBorrowerApi,
  });

  // Score once on mount (with the default borrower) so the result panel
  // isn't empty before the user's first submit, then again on every submit.
  useEffect(() => {
    scoreM.mutate(submitted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const result = scoreM.data;
  const bars = (result?.contributions ?? []).map((c) => ({
    label: c.label,
    up: c.value > 0 ? c.value : undefined,
    down: c.value < 0 ? c.value : undefined,
  }));

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Single Borrower Risk Scoring"
          description="Submit borrower attributes to the scorecard for an on-demand probability of default, tier assignment and feature attribution."
        />

        <div className="grid gap-3 lg:grid-cols-[380px_1fr]">
          <Panel title="Borrower Features" subtitle="Model input vector">
            <form
              className="space-y-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(draft);
              }}
            >
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="label-xs flex items-center justify-between">
                    {f.label}
                    <span className="num normal-case tracking-normal">{f.suffix}</span>
                  </span>
                  <input
                    type="number"
                    step={f.step}
                    min={0}
                    value={draft[f.key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [f.key]: Number(e.target.value) || 0 })
                    }
                    className="num mt-1.5 w-full rounded-md border border-input bg-elevated px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-data focus:ring-2 focus:ring-data/25"
                  />
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={scoreM.isPending}
                  className="num flex-1 rounded-md bg-data px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {scoreM.isPending ? "SCORING…" : "RUN SCORE"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(DEFAULT_BORROWER);
                    setSubmitted(DEFAULT_BORROWER);
                  }}
                  className="rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Reset
                </button>
              </div>
            </form>
          </Panel>

          <div className="space-y-3">
            {!result && (scoreM.isPending || scoreM.isError) ? (
              <Panel bodyClassName="p-3">
                <QueryState
                  isLoading={scoreM.isPending}
                  error={scoreM.isError ? scoreM.error : null}
                  onRetry={() => scoreM.mutate(submitted)}
                  label="Scoring borrower…"
                />
              </Panel>
            ) : result ? (
              <>
                <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_1fr]">
                  <Panel title="Scoring Result" bodyClassName="p-4 pb-3">
                    <Gauge pd={result.pd} tier={result.tier} />
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <span className="label-xs">Risk Tier</span>
                      <TierBadge tier={result.tier} />
                    </div>
                  </Panel>

                  <Panel title="Loss Decomposition" subtitle="Basel-style expected loss components">
                    <dl className="grid grid-cols-2 gap-3">
                      {[
                        { k: "Risk Score", v: `${result.score} / 100` },
                        { k: "Exposure at Default", v: inr(submitted.loanAmount) },
                        { k: "Loss Given Default", v: pct(result.lgd, 0) },
                        { k: "Expected Loss", v: inr(result.expectedLoss) },
                      ].map((row) => (
                        <div key={row.k} className="rounded-md border border-border bg-elevated px-3 py-2.5">
                          <dt className="label-xs">{row.k}</dt>
                          <dd className="num mt-1 text-lg font-semibold text-foreground">{row.v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      Expected loss is calculated as EAD × PD × LGD. A {result.tier.toLowerCase()}-tier
                      outcome routes this application to{" "}
                      {result.tier === "Low" || result.tier === "Medium"
                        ? "auto-decision"
                        : "manual underwriting review"}
                      .
                    </p>
                  </Panel>
                </div>

                <Panel
                  title="Feature Contributions"
                  subtitle="SHAP attribution to log-odds of default — red increases risk, green reduces it"
                  bodyClassName="p-3"
                >
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bars} layout="vertical" margin={{ left: 8, right: 56, top: 4 }}>
                        <XAxis type="number" tick={chartAxis} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={172}
                          interval={0}
                          tick={{ ...chartAxis, fontFamily: "Inter, sans-serif", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <ReferenceLine x={0} stroke="oklch(1 0 0 / 22%)" />
                        <Tooltip {...tooltipStyle} formatter={(v: number) => v.toFixed(3)} />
                        <Bar dataKey="up" stackId="c" radius={2} barSize={16} fill={TIER_HEX.Critical}>
                          <LabelList
                            dataKey="up"
                            position="right"
                            className="num"
                            fill="oklch(0.68 0.02 258)"
                            fontSize={11}
                            formatter={(v: number) => (v ? `+${v.toFixed(2)}` : "")}
                          />
                        </Bar>
                        <Bar dataKey="down" stackId="c" radius={2} barSize={16} fill={TIER_HEX.Low}>
                          <LabelList
                            dataKey="down"
                            position="left"
                            className="num"
                            fill="oklch(0.68 0.02 258)"
                            fontSize={11}
                            formatter={(v: number) => (v ? v.toFixed(2) : "")}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
