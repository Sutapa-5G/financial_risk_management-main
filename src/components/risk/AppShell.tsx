import { Link } from "@tanstack/react-router";
import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  GaugeCircle,
  LayoutDashboard,
  Settings,
  Table2,
  ShieldHalf,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/risk-scoring", label: "Risk Scoring", icon: GaugeCircle },
  { to: "/portfolio-analytics", label: "Portfolio Analytics", icon: Table2 },
  { to: "/model-performance", label: "Model Performance", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <ShieldHalf className="size-5 shrink-0 text-data" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="num truncate text-sm font-semibold">RISKLENS</p>
              <p className="text-[10px] tracking-wider text-muted-foreground">CREDIT RISK ENGINE</p>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className={cn(
                "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
              activeProps={{
                className:
                  "bg-data/12 text-foreground shadow-[inset_2px_0_0_0_var(--data)] hover:bg-data/16",
              }}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" /> Collapse
            </>
          )}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          <nav className="flex items-center gap-1 overflow-x-auto md:hidden">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                aria-label={label}
                className="rounded-md p-2 text-muted-foreground"
                activeProps={{ className: "bg-data/12 text-foreground" }}
              >
                <Icon className="size-4" />
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <span className="size-2 animate-pulse rounded-full bg-risk-low" />
            <span className="num text-xs text-muted-foreground">
              MODEL pd_xgb_v4.2 · LIVE · refreshed 04:12 UTC
            </span>
          </div>
          <div className="num flex items-center gap-4 text-xs text-muted-foreground">
            <span className="hidden sm:inline">FY26 Q3</span>
            <span className="hidden sm:inline text-border-strong">|</span>
            <span className="text-foreground">T. Mondal · Risk Analytics</span>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
