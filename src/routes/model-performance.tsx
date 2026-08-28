import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/risk/AppShell";
import {
  DATA_HEX,
  PageHeader,
  Panel,
  QueryState,
  TIER_HEX,
  chartAxis,
  tooltipStyle,
} from "@/components/risk/primitives";
import {
  getCalibration,
  getConfusionMatrix,
  getModelMetrics,
  getModelSummary,
  getRocCurve,
} from "@/lib/api";
import { num } from "@/lib/format";

export const Route = createFileRoute("/model-performance")({
  head: () => ({
    meta: [
      { title: "Model Performance — RiskLens Credit Risk Engine" },
      {
        name: "description",
        content:
          "Validation metrics for the default prediction model: AUC-ROC, precision, recall, F1, KS statistic, ROC curve, confusion matrix and calibration by decile.",
      },
      { property: "og:title", content: "Model Performance — RiskLens Credit Risk Engine" },
      {
        property: "og:description",
        content: "Discrimination and calibration diagnostics for the PD model on hold-out data.",
      },
    ],
  }),
  component: ModelPerformance,
});

const TONE_HEX = {
  low: TIER_HEX.Low,
  medium: TIER_HEX.Medium,
  critical: TIER_HEX.Critical,
  data: DATA_HEX,
};

function ModelPerformance() {
  const metricsQ = useQuery({ queryKey: ["model", "metrics"], queryFn: getModelMetrics });
  const rocQ = useQuery({ queryKey: ["model", "roc"], queryFn: getRocCurve });
  const cmQ = useQuery({ queryKey: ["model", "confusion"], queryFn: getConfusionMatrix });
  const calQ = useQuery({ queryKey: ["model", "calibration"], queryFn: getCalibration });
  const summaryQ = useQuery({ queryKey: ["model", "summary"], queryFn: getModelSummary });

  const isLoading = metricsQ.isLoading || rocQ.isLoading || cmQ.isLoading || calQ.isLoading || summaryQ.isLoading;
  const error = metricsQ.error ?? rocQ.error ?? cmQ.error ?? calQ.error ?? summaryQ.error;
  const retry = () => {
    metricsQ.refetch();
    rocQ.refetch();
    cmQ.refetch();
    calQ.refetch();
    summaryQ.refetch();
  };

  if (isLoading || error) {
    return (
      <AppShell>
        <div className="space-y-5">
          <PageHeader
            title="Model Performance"
            description="Out-of-time validation for the deployed credit risk model."
          />
          <QueryState isLoading={isLoading} error={error} onRetry={retry} />
        </div>
      </AppShell>
    );
  }

  const metrics = metricsQ.data!;
  const roc = rocQ.data!;
  const cm = cmQ.data!;
  const calibration = calQ.data!;
  const summary = summaryQ.data!;

  const auc = metrics.find((m) => m.name === "AUC-ROC")?.value ?? 0;

  const matrix = [
    { label: "True Negative", value: cm.trueNegative, tone: "low" as const, note: "Predicted good · repaid" },
    { label: "False Positive", value: cm.falsePositive, tone: "medium" as const, note: "Predicted default · repaid" },
    { label: "False Negative", value: cm.falseNegative, tone: "critical" as const, note: "Predicted good · defaulted" },
    { label: "True Positive", value: cm.truePositive, tone: "data" as const, note: "Predicted default · defaulted" },
  ];
  const max = Math.max(...matrix.map((m) => m.value));

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Model Performance"
          description={`Out-of-time validation for ${summary.productionModel} — ${summary.testSetSize.toLocaleString(
            "en-IN",
          )} hold-out applications, decision threshold ${summary.decisionThreshold.toFixed(3)} (Youden's J).`}
        />

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {metrics.map((m) => (
            <div key={m.name} className="panel px-4 py-3.5">
              <p className="label-xs">{m.name}</p>
              <p className="num mt-2 text-2xl font-semibold text-foreground">{m.value.toFixed(3)}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{m.hint}</p>
            </div>
          ))}
        </div>

        <Panel title="Model Card" bodyClassName="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="label-xs">Production Model</p>
              <p className="num mt-1 text-sm font-medium text-foreground">{summary.productionModel}</p>
            </div>
            <div>
              <p className="label-xs">Baseline (Logistic Regression)</p>
              <p className="num mt-1 text-sm font-medium text-foreground">
                AUC-ROC {summary.baselineAucRoc.toFixed(3)}
              </p>
            </div>
            <div>
              <p className="label-xs">Hold-out Default Rate</p>
              <p className="num mt-1 text-sm font-medium text-foreground">
                {(summary.testSetDefaultRate * 100).toFixed(2)}%
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{summary.productionModelNote}</p>
        </Panel>

        <div className="grid gap-3 xl:grid-cols-2">
          <Panel title="ROC Curve" subtitle="True positive rate vs false positive rate" bodyClassName="p-3">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={roc} margin={{ top: 8, right: 12, left: -18 }}>
                  <CartesianGrid stroke="oklch(1 0 0 / 7%)" />
                  <XAxis
                    dataKey="fpr"
                    type="number"
                    domain={[0, 1]}
                    tick={chartAxis}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis domain={[0, 1]} tick={chartAxis} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => v.toFixed(3)} />
                  <Line
                    type="monotone"
                    dataKey="tpr"
                    name={`Model (AUC ${auc.toFixed(3)})`}
                    stroke={DATA_HEX}
                    strokeWidth={2.2}
                    dot={false}
                  />
                  <Line
                    dataKey="baseline"
                    name="Random"
                    stroke="oklch(0.68 0.02 258)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Legend
                    iconType="plainline"
                    formatter={(v) => (
                      <span className="num text-[11px] text-muted-foreground">{v}</span>
                    )}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            title="Confusion Matrix"
            subtitle={`Counts at ${summary.decisionThreshold.toFixed(3)} threshold, colour intensity by volume`}
          >
            <div className="grid grid-cols-2 gap-2">
              {matrix.map((cell) => (
                <div
                  key={cell.label}
                  className="rounded-md border border-border px-4 py-5"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${TONE_HEX[cell.tone]} ${8 + (cell.value / max) * 26}%, transparent)`,
                  }}
                >
                  <p className="label-xs">{cell.label}</p>
                  <p
                    className="num mt-2 text-3xl font-semibold"
                    style={{ color: TONE_HEX[cell.tone] }}
                  >
                    {num(cell.value)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{cell.note}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              False negatives carry the largest economic cost — each represents an approved loan that
              subsequently defaulted.
            </p>
          </Panel>
        </div>

        <Panel
          title="Calibration by Decile"
          subtitle="Predicted vs actual default rate (%) across risk deciles"
          bodyClassName="p-3"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calibration} margin={{ top: 8, right: 12, left: -18 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 7%)" vertical={false} />
                <XAxis dataKey="decile" tick={chartAxis} axisLine={false} tickLine={false} />
                <YAxis
                  tick={chartAxis}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip {...tooltipStyle} formatter={(v: number) => `${v}%`} />
                <Legend
                  iconType="square"
                  iconSize={8}
                  formatter={(v) => <span className="num text-[11px] text-muted-foreground">{v}</span>}
                />
                <Bar dataKey="predicted" name="Predicted" fill={DATA_HEX} radius={[2, 2, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill={TIER_HEX.Medium} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
