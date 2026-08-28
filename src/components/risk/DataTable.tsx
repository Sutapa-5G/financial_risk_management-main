import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  sortValue?: (row: T) => number | string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  pageSize = 10,
  initialSort,
}: {
  rows: T[];
  columns: Column<T>[];
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "label-xs px-3 py-2 font-medium whitespace-nowrap",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {col.sortValue ? (
                      <button
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                          active && "text-foreground",
                          col.align === "right" && "flex-row-reverse",
                        )}
                        onClick={() =>
                          setSort(
                            active
                              ? { key: col.key, dir: sort!.dir === "asc" ? "desc" : "asc" }
                              : { key: col.key, dir: "desc" },
                          )
                        }
                      >
                        {col.header}
                        {active &&
                          (sort!.dir === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          ))}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-elevated/70"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-2.5 whitespace-nowrap",
                      col.align === "right" && "text-right",
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  No loans match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <p className="num text-xs text-muted-foreground">
          {sorted.length === 0 ? 0 : current * pageSize + 1}–
          {Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(Math.max(0, current - 1))}
            disabled={current === 0}
            className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="num px-2 text-xs text-muted-foreground">
            {current + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
            disabled={current >= pageCount - 1}
            className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
