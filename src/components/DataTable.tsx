import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type DataColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
};

export type DataTableProps = {
  columns: DataColumn[];
  rows: Array<Record<string, ReactNode>>;
  emptyLabel?: string;
  className?: string;
};

export function DataTable({ columns, rows, emptyLabel = "No records yet.", className }: DataTableProps) {
  return (
    <div className={cn("rounded-3xl border border-border/40 bg-surface shadow-sm overflow-hidden", className)}>
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
                  {column.label}
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
