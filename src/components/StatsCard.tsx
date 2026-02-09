import { cn } from "@/lib/utils";

export type StatsCardProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
};

export function StatsCard({ label, value, delta, trend = "flat" }: StatsCardProps) {
  return (
    <div className="panel p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-text-muted">{label}</p>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-semibold">{value}</span>
        {delta ? (
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              trend === "up" && "bg-success/20 text-text",
              trend === "down" && "bg-danger/20 text-text",
              trend === "flat" && "bg-surface-2/70 text-text"
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}
