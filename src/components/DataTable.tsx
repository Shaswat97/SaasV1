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
};

export function DataTable({ columns, rows, emptyLabel = "No records yet." }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-2">
        <thead>
            <tr className="text-left text-xs uppercase tracking-[0.2em] text-text-muted">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn("px-4 py-2", column.align === "right" && "text-right", column.align === "center" && "text-center")}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-sm text-text-muted">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="bg-surface/80">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-4 text-sm text-text border-t border-border/40",
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
  );
}
