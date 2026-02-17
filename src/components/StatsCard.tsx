import { cn } from "@/lib/utils";

export type StatsCardProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  deltaMode?: "badge" | "text";
};

export function StatsCard({ label, value, delta, trend = "flat", deltaMode = "badge" }: StatsCardProps) {
  return (
    <div className="panel p-5 h-full">
      <p className="text-xs uppercase tracking-[0.25em] text-text-muted">{label}</p>
      <div className="mt-4">
        <span className="text-3xl font-semibold leading-none">{value}</span>
      </div>
      {delta ? (
        deltaMode === "text" ? (
          <p className="mt-3 text-sm text-text-muted">{delta}</p>
        ) : (
          <div className="mt-3">
            <span
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-xs",
                trend === "up" && "bg-success/20 text-text",
                trend === "down" && "bg-danger/20 text-text",
                trend === "flat" && "bg-surface-2/70 text-text"
              )}
            >
              {delta}
            </span>
          </div>
        )
      ) : null}
    </div>
  );
}
