import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type DataColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  tooltip?: string;
};

export type DataTableProps = {
  columns: DataColumn[];
  rows: Array<Record<string, ReactNode>>;
  emptyLabel?: string;
  className?: string;
};

export function DataTable({ columns, rows, emptyLabel = "No records yet.", className }: DataTableProps) {
  return (
    <div className={cn("rounded-3xl border border-border/40 bg-surface shadow-sm overflow-visible", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left bg-surface">
          <thead>
            <tr className="border-b border-border/50 bg-bg-subtle/30">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-6 py-4 text-xs font-medium uppercase tracking-wider text-text-muted whitespace-nowrap",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center"
                  )}
                >
                  {column.tooltip ? (
                    <div
                      title={column.tooltip}
                      className={cn(
                        "group relative inline-flex items-center gap-1.5",
                        column.align === "right" && "w-full justify-end",
                        column.align === "center" && "w-full justify-center"
                      )}
                    >
                      <span>{column.label}</span>
                      <span
                        aria-hidden="true"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 text-[10px] font-semibold normal-case tracking-normal text-text-muted"
                      >
                        i
                      </span>
                      <div
                        role="tooltip"
                        className={cn(
                          "pointer-events-none absolute top-full z-20 mt-2 hidden w-72 rounded-xl border border-border/60 bg-surface px-3 py-2 text-left text-[11px] leading-relaxed normal-case tracking-normal whitespace-normal text-text shadow-lg",
                          "group-hover:block group-focus-within:block",
                          column.align === "right" ? "right-0" : column.align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
                        )}
                      >
                        {column.tooltip}
                      </div>
                    </div>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-text-muted">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="group transition-colors hover:bg-bg-subtle/40">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-6 py-4 text-sm text-text align-middle whitespace-nowrap",
                        column.align === "right" && "text-right",
                        column.align === "center" && "text-center"
                      )}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
