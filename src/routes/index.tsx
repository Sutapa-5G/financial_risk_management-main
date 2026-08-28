import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/risk/AppShell";
import { DataTable, type Column } from "@/components/risk/DataTable";
import {
  DATA_HEX,
  KpiCard,
  PageHeader,
  Panel,
  QueryState,
  StatusPill,
  TIER_HEX,
  TierBadge,
  chartAxis,
  tooltipStyle,
} from "@/components/risk/primitives";
import type { Loan } from "@/data/portfolio";
import {
  getPortfolioSummary,
  getPortfolioTrend,
  getRecentApplications,
  getTierBreakdown,
} from "@/lib/api";
import { compactInr, pct, inr } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Risk Overview — RiskLens Credit Risk Engine" },
      {
        name: "description",
        content:
          "Portfolio-level credit default risk overview: exposure, default rate trend, risk tier mix and the latest scored loan applications.",
      },
      { property: "og:title", content: "Risk Overview — RiskLens Credit Risk Engine" },
      {
        property: "og:description",
        content:
          "Portfolio exposure, expected loss and default rate trends for a bank credit risk book.",
      },
    ],
  }),
  component: Overview,
});

const columns: Column<Loan>[] = [
  {
    key: "applicant",
    header: "Applicant ID",
    sortValue: (r) => r.applicant,
    render: (r) => <span className="num text-foreground">{r.applicant}</span>,
  },
  {
    key: "amount",
    header: "Loan Amount",
    align: "right",
    sortValue: (r) => r.amount,
    render: (r) => <span className="num">{inr(r.amount)}</span>,
  },
  {
    key: "score",
    header: "Risk Score",
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
    header: "Predicted PD",
    align: "right",
    sortValue: (r) => r.pd,
    render: (r) => <span className="num">{pct(r.pd)}</span>,
  },
  {
    key: "tier",
    header: "Risk Tier",
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

function Overview() {
  const summaryQ = useQuery({ queryKey: ["portfolio", "summary"], queryFn: getPortfolioSummary });
  const trendQ = useQuery({ queryKey: ["portfolio", "trend"], queryFn: getPortfolioTrend });
  const tierQ = useQuery({ queryKey: ["portfolio", "tier-breakdown"], queryFn: getTierBreakdown });
  const recentQ = useQuery({
    queryKey: ["portfolio", "recent"],
    queryFn: () => getRecentApplications(8),
  });

  const isLoading = summaryQ.isLoading || trendQ.isLoading || tierQ.isLoading || recentQ.isLoading;
  const error = summaryQ.error ?? trendQ.error ?? tierQ.error ?? recentQ.error;

  const retry = () => {
    summaryQ.refetch();
    trendQ.refetch();
    tierQ.refetch();
    recentQ.refetch();
  };

  if (isLoading || error) {
    return (
      <AppShell>
        <div className="space-y-5">
          <PageHeader
            title="Portfolio Risk Overview"
            description="Consolidated view of credit default exposure across the retail lending book."
          />
          <QueryState isLoading={isLoading} error={error} onRetry={retry} />
        </div>
      </AppShell>
    );
  }

  const summary = summaryQ.data!;
  const trend = trendQ.data!;
  const tierBreakdown = tierQ.data!;
  const recent = recentQ.data!;
  const pieData = tierBreakdown.map((t) => ({ name: t.tier, value: t.exposure, count: t.count }));

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Portfolio Risk Overview"
          description="Consolidated view of credit default exposure across the retail lending book. Figures are served live from the risk engine's scoring API."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Portfolio Value"
            value={compactInr(summary.portfolioValue)}
            footnote="exposure at default"
          />
          <KpiCard
            label="Overall Default Rate"
            value={pct(summary.overallDefaultRate)}
            invertDelta
            footnote="exposure-weighted PD"
          />
          <KpiCard
            label="Expected Loss (12m)"
            value={compactInr(summary.totalExpectedLoss)}
            invertDelta
            footnote="EL = EAD × PD × LGD"
          />
          <KpiCard
            label="Average Risk Score"
            value={summary.avgRiskScore.toFixed(1)}
            invertDelta
            footnote="scale 0–100"
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Default Rate Trend"
            subtitle="Realised vs model-forecast default rate, trailing 12 months (%)"
            actions={
              <div className="num flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-risk-high" /> Realised
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-data" /> Forecast
                </span>
              </div>
            }
            bodyClassName="p-3"
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="defRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TIER_HEX.High} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={TIER_HEX.High} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(1 0 0 / 7%)" vertical={false} />
                  <XAxis dataKey="month" tick={chartAxis} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={chartAxis}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    name="Realised"
                    stroke={TIER_HEX.High}
                    strokeWidth={2}
                    fill="url(#defRate)"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast"
                    stroke={DATA_HEX}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            title="Exposure by Risk Tier"
            subtitle="Share of outstanding principal"
            bodyClassName="p-3"
          >
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 4, bottom: 4 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    innerRadius={54}
                    outerRadius={82}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={TIER_HEX[d.name as keyof typeof TIER_HEX]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: number) => inr(v)} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={7}
                    formatter={(v) => <span className="num text-[11px] text-muted-foreground">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-x-0 top-[34%] text-center">
                <p className="num text-lg font-semibold text-foreground">
                  {compactInr(summary.portfolioValue)}
                </p>
                <p className="label-xs">Exposure</p>
              </div>
            </div>
            <div className="mt-2 divide-y divide-border border-t border-border">
              {tierBreakdown.map((t) => (
                <div key={t.tier} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="num text-muted-foreground">
                    {t.tier} · {t.count} loans
                  </span>
                  <span className="num text-foreground">{compactInr(t.exposure)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel
          title="Recent Scoring Activity"
          subtitle="Latest loan applications processed through the scoring engine"
          bodyClassName="p-3 pt-2"
        >
          <DataTable rows={recent} columns={columns} pageSize={8} />
        </Panel>
      </div>
    </AppShell>
  );
}
