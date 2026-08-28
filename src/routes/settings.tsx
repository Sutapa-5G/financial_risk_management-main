import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/risk/AppShell";
import { PageHeader, Panel, TIER_HEX } from "@/components/risk/primitives";
import { TIER_ORDER } from "@/data/portfolio";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RiskLens Credit Risk Engine" },
      {
        name: "description",
        content:
          "Configure scoring thresholds, risk tier cut-offs, model version and data source bindings for the credit risk workspace.",
      },
      { property: "og:title", content: "Settings — RiskLens Credit Risk Engine" },
      {
        property: "og:description",
        content: "Model version, decision thresholds and tier cut-off configuration.",
      },
    ],
  }),
  component: Settings,
});

const CUTOFFS: Record<string, string> = {
  Low: "0 – 29",
  Medium: "30 – 54",
  High: "55 – 77",
  Critical: "78 – 100",
};

function Settings() {
  const [threshold, setThreshold] = useState(0.35);
  const [autoDecision, setAutoDecision] = useState(true);

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Workspace Settings"
          description="Scoring configuration for the risk analytics workspace. Values are local to this session until wired to the model registry."
        />

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Decision Policy" subtitle="Threshold and routing rules">
            <label className="block">
              <span className="label-xs flex items-center justify-between">
                Default Probability Threshold
                <span className="num text-foreground normal-case">{threshold.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-2 w-full accent-[oklch(0.68_0.16_250)]"
              />
            </label>
            <label className="mt-5 flex items-center justify-between gap-4 rounded-md border border-border bg-elevated px-3 py-2.5">
              <span className="text-sm text-foreground">
                Auto-decision Low & Medium tiers
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Skip manual underwriting queue
                </span>
              </span>
              <button
                onClick={() => setAutoDecision((v) => !v)}
                role="switch"
                aria-checked={autoDecision}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${autoDecision ? "bg-data" : "bg-muted"}`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-background transition-all ${autoDecision ? "left-5.5" : "left-0.5"}`}
                />
              </button>
            </label>
          </Panel>

          <Panel title="Risk Tier Cut-offs" subtitle="Score bands mapped to tiers">
            <div className="divide-y divide-border">
              {TIER_ORDER.map((tier) => (
                <div key={tier} className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: TIER_HEX[tier] }}
                    />
                    {tier}
                  </span>
                  <span className="num text-sm text-muted-foreground">{CUTOFFS[tier]}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Model Binding" subtitle="Active artefact and data sources" className="lg:col-span-2">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { k: "Active Model", v: "pd_xgb_v4.2" },
                { k: "Trained", v: "2026-07-28" },
                { k: "Feature Store", v: "retail_credit.v3" },
                { k: "Data Source", v: "mock (no backend)" },
              ].map((row) => (
                <div key={row.k} className="rounded-md border border-border bg-elevated px-3 py-2.5">
                  <dt className="label-xs">{row.k}</dt>
                  <dd className="num mt-1 text-sm text-foreground">{row.v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
