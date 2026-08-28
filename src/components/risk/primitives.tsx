import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RiskTier } from "@/data/portfolio";

const TIER_STYLES: Record<RiskTier, string> = {
  Low: "text-risk-low border-risk-low/35 bg-risk-low/12",
  Medium: "text-risk-medium border-risk-medium/35 bg-risk-medium/12",
  High: "text-risk-high border-risk-high/35 bg-risk-high/12",
  Critical: "text-risk-critical border-risk-critical/40 bg-risk-critical/14",
};

export const TIER_HEX: Record<RiskTier, string> = {
  Low: "oklch(0.74 0.17 155)",
  Medium: "oklch(0.82 0.16 88)",
  High: "oklch(0.72 0.18 55)",
  Critical: "oklch(0.63 0.22 22)",
};

export const DATA_HEX = "oklch(0.68 0.16 250)";

export function TierBadge({ tier, className }: { tier: RiskTier; className?: string }) {
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        TIER_STYLES[tier],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {tier}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Approved: "text-risk-low",
  Current: "text-data",
  Pending: "text-muted-foreground",
  Declined: "text-risk-high",
  Delinquent: "text-risk-critical",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("text-xs font-medium", STATUS_STYLES[status] ?? "text-foreground")}>
      {status}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  invertDelta,
  footnote,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  invertDelta?: boolean;
  footnote?: string;
}) {
  const good = delta === undefined ? true : invertDelta ? delta < 0 : delta > 0;
  return (
    <div className="panel relative overflow-hidden px-4 py-3.5">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-border-strong to-transparent" />
      <p className="label-xs">{label}</p>
      <p className="num mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {delta !== undefined && (
          <span
            className={cn(
              "num text-xs font-medium",
              good ? "text-risk-low" : "text-risk-critical",
            )}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
            {deltaLabel ?? "%"}
          </span>
        )}
        {footnote && <span className="text-xs text-muted-foreground">{footnote}</span>}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  );
}

export const chartAxis = {
  stroke: "oklch(0.68 0.02 258)",
  fontSize: 11,
  fontFamily: "JetBrains Mono, monospace",
};

export const tooltipStyle = {
  contentStyle: {
    background: "oklch(0.213 0.024 264)",
    border: "1px solid oklch(1 0 0 / 16%)",
    borderRadius: 8,
    fontSize: 12,
    fontFamily: "JetBrains Mono, monospace",
    color: "oklch(0.97 0.005 250)",
  },
  labelStyle: { color: "oklch(0.68 0.02 258)", fontSize: 11 },
  itemStyle: { color: "oklch(0.97 0.005 250)" },
};

/**
 * Full-page loading / error state for a page whose data comes entirely from
 * the backend API. Error state surfaces a hint about the local API server
 * since the most common cause during development is simply "backend isn't
 * running".
 */
export function QueryState({
  isLoading,
  error,
  onRetry,
  label = "Loading data from the risk engine…",
}: {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  label?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-data" />
        <p className="num text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-risk-critical/30 bg-risk-critical/8 px-6 py-10 text-center">
        <p className="text-sm font-medium text-risk-critical">Couldn't load data</p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="num mt-1 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-elevated"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  return null;
}
