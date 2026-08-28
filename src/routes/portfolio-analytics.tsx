import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/risk/AppShell";
import { DataTable, type Column } from "@/components/risk/DataTable";
import {
  PageHeader,
  Panel,
  QueryState,
  StatusPill,
  TIER_HEX,
  TierBadge,
  chartAxis,
  tooltipStyle,
} from "@/components/risk/primitives";
import { TIER_ORDER, type Loan, type RiskTier } from "@/data/portfolio";
import { getLoans, getTierBreakdown, runStressTest, type StressTestResult } from "@/lib/api";
import { compactInr, pct, inr } from "@/lib/format";

export const Route = createFileRoute("/portfolio-analytics")({
  head: () => ({
    meta: [
      { title: "Portfolio Analytics — RiskLens Credit Risk Engine" },
      {
        name: "description",
        content:
          "Filter and sort the full loan book, inspect expected loss by risk tier and stress-test the portfolio against unemployment and rate shocks.",
      },
      { property: "og:title", content: "Portfolio Analytics — RiskLens Credit Risk Engine" },
      {
        property: "og:description",
        content: "Loan-level analytics, expected loss by tier and macro stress testing.",
      },
    ],
  }),
  component: PortfolioAnalytics,
});

const STATUS_OPTIONS = ["All", "Approved", "Pending", "Declined", "Current", "Delinquent"];

const columns: Column<Loan>[] = [
  { key: "id", header: "ID", sortValue: (r) => r.id, render: (r) => <span className="num">{r.id}</span> },
  {
    key: "amount",
    header: "Loan Amount",
    align: "right",
    sortValue: (r) => r.amount,
    render: (r) => <span className="num">{inr(r.amount)}</span>,
  },
  {
    key: "rate",
    header: "Rate",
    align: "right",
    sortValue: (r) => r.interestRate,
    render: (r) => <span className="num">{r.interestRate.toFixed(2)}%</span>,
  },
  {
    key: "term",
    header: "Term",
    align: "right",
    sortValue: (r) => r.termMonths,
    render: (r) => <span className="num">{r.termMonths}m</span>,
  },
  {
    key: "score",
    header: "Score",
    align: "right",
    sortValue: (r) => r.riskScore,
    render: (r) => (
      <span className="num font-medium" style={{ color: TIER_HEX[r.tier] }}>
        {r.riskScore}
      </span>
    ),
  },
  {
    key: "pd",
    header: "PD",
    align: "right",
    sortValue: (r) => r.pd,
    render: (r) => <span className="num">{pct(r.pd)}</span>,
  },
  {
    key: "lgd",
    header: "LGD",
    align: "right",
    sortValue: (r) => r.lgd,
    render: (r) => <span className="num">{pct(r.lgd, 0)}</span>,
  },
  {
    key: "el",
    header: "Expected Loss",
    align: "right",
    sortValue: (r) => r.expectedLoss,
    render: (r) => <span className="num text-foreground">{inr(r.expectedLoss)}</span>,
  },
  {
    key: "tier",
    header: "Tier",
    sortValue: (r) => r.riskScore,
    render: (r) => <TierBadge tier={r.tier} />,
  },
  {
    key: "status",
    header: "Status",
    sortValue: (r) => r.status,
    render: (r) => <StatusPill status={r.status} />,
  },
];

/** Debounce a fast-changing value (slider drag) before it triggers a network call. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function PortfolioAnalytics() {
  const [tier, setTier] = useState<RiskTier | "All">("All");
  const [status, setStatus] = useState("All");
  const [minAmount, setMinAmount] = useState(0);
  const [maxAmount, setMaxAmount] = useState(3000000);
  const [unemploymentShock, setUnemploymentShock] = useState(0);
  const [rateShock, setRateShock] = useState(0);

  const loansQ = useQuery({
    queryKey: ["portfolio", "loans", "all"],
    queryFn: () => getLoans({ pageSize: 300 }),
  });
  const tierQ = useQuery({ queryKey: ["portfolio", "tier-breakdown"], queryFn: getTierBreakdown });

  const debouncedUnemployment = useDebounced(unemploymentShock, 300);
  const debouncedRate = useDebounced(rateShock, 300);

  const stressQ = useQuery({
    queryKey: ["stress-test", debouncedUnemployment, debouncedRate],
    queryFn: () =>
      runStressTest({
        unemploymentShock: debouncedUnemployment,
        interestRateShock: debouncedRate,
      }),
    placeholderData: (previous: StressTestResult | undefined) => previous,
  });

  const allLoans = loansQ.data?.items ?? [];

  const rows = useMemo(
    () =>
      allLoans.filter(
        (l) =>
          (tier === "All" || l.tier === tier) &&
          (status === "All" || l.status === status) &&
          l.amount >= minAmount &&
          l.amount <= maxAmount,
      ),
    [allLoans, tier, status, minAmount, maxAmount],
  );

  const isLoading = loansQ.isLoading || tierQ.isLoading;
  const error = loansQ.error ?? tierQ.error;
  const retry = () => {
    loansQ.refetch();
    tierQ.refetch();
  };

  if (isLoading || error) {
    return (
      <AppShell>
        <div className="space-y-5">
          <PageHeader
            title="Portfolio Analytics"
            description="Loan-level risk decomposition across the full book with macroeconomic stress overlays."
          />
          <QueryState isLoading={isLoading} error={error} onRetry={retry} />
        </div>
      </AppShell>
    );
  }

  const tierBreakdown = tierQ.data!;
  const stress = stressQ.data;

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Portfolio Analytics"
          description="Loan-level risk decomposition across the full book with macroeconomic stress overlays."
        />

        <div className="grid gap-3 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Loss Distribution by Risk Tier"
            subtitle="Expected vs unexpected loss (₹)"
            bodyClassName="p-3"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierBreakdown} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="oklch(1 0 0 / 7%)" vertical={false} />
                  <XAxis dataKey="tier" tick={chartAxis} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={chartAxis}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => compactInr(v)}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} />
                  <Legend
                    iconType="square"
                    iconSize={8}
                    formatter={(v) => (
                      <span className="num text-[11px] text-muted-foreground">{v}</span>
                    )}
                  />
                  <Bar
                    dataKey="expectedLoss"
                    name="Expected Loss"
                    stackId="a"
                    fill={TIER_HEX.High}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="unexpectedLoss"
                    name="Unexpected Loss (99.9%)"
                    stackId="a"
                    fill="oklch(0.72 0.18 55 / 30%)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Stress Test" subtitle="Macro shock scenario overlay — live model re-scoring">
            <div className="space-y-5">
              {[
                {
                  label: "Unemployment Rate Shock",
                  value: unemploymentShock,
                  set: setUnemploymentShock,
                  max: 8,
                },
                { label: "Interest Rate Shock", value: rateShock, set: setRateShock, max: 6 },
              ].map((s) => (
                <label key={s.label} className="block">
                  <span className="label-xs flex items-center justify-between">
                    {s.label}
                    <span className="num text-foreground normal-case">+{s.value.toFixed(1)}pp</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={s.max}
                    step={0.1}
                    value={s.value}
                    onChange={(e) => s.set(Number(e.target.value))}
                    className="mt-2 w-full accent-[oklch(0.68_0.16_250)]"
                  />
                </label>
              ))}

              <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                <div className="rounded-md border border-border bg-elevated px-3 py-2.5">
                  <p className="label-xs">Stressed Default Rate</p>
                  <p className="num mt-1 text-xl font-semibold text-risk-high">
                    {stress ? pct(stress.stressedDefaultRate) : "—"}
                  </p>
                  <p className="num mt-0.5 text-[11px] text-muted-foreground">
                    base {stress ? pct(stress.baselineDefaultRate) : "—"}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-elevated px-3 py-2.5">
                  <p className="label-xs">Stressed Expected Loss</p>
                  <p className="num mt-1 text-xl font-semibold text-risk-critical">
                    {stress ? compactInr(stress.stressedExpectedLoss) : "—"}
                  </p>
                  <p className="num mt-0.5 text-[11px] text-muted-foreground">
                    base {stress ? compactInr(stress.baselineExpectedLoss) : "—"}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {stressQ.isFetching
                  ? "Re-scoring the portfolio with the trained model…"
                  : "Every loan in the book is re-scored by the trained PD model with shocked DTI, utilization and rate inputs — not a static multiplier."}
              </p>
            </div>
          </Panel>
        </div>

        <Panel
          title="Loan Book"
          subtitle={`${rows.length} of ${allLoans.length} exposures shown`}
          bodyClassName="p-3 pt-3"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as RiskTier | "All")}
                className="num rounded-md border border-input bg-elevated px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-data"
              >
                {["All", ...TIER_ORDER].map((t) => (
                  <option key={t} value={t}>
                    Tier: {t}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="num rounded-md border border-input bg-elevated px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-data"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    Status: {s}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={minAmount}
                  step={5000}
                  onChange={(e) => setMinAmount(Number(e.target.value) || 0)}
                  className="num w-24 rounded-md border border-input bg-elevated px-2 py-1.5 text-xs outline-none focus:border-data"
                  aria-label="Minimum loan amount"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <input
                  type="number"
                  value={maxAmount}
                  step={5000}
                  onChange={(e) => setMaxAmount(Number(e.target.value) || 0)}
                  className="num w-24 rounded-md border border-input bg-elevated px-2 py-1.5 text-xs outline-none focus:border-data"
                  aria-label="Maximum loan amount"
                />
              </div>
            </div>
          }
        >
          <DataTable
            rows={rows}
            columns={columns}
            pageSize={12}
            initialSort={{ key: "el", dir: "desc" }}
          />
        </Panel>
      </div>
    </AppShell>
  );
}
