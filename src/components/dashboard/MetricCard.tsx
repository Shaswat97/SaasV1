import { LucideIcon, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
    label: string;
    value: string;
    scopeLabel?: string;
    trend?: string;
    trendDirection?: "up" | "down" | "flat";
    subtext?: string;
    icon?: LucideIcon;
    iconColor?: string; // e.g., "text-blue-500"
    className?: string;
}

export function MetricCard({
    label,
    value,
    scopeLabel,
    trend,
    trendDirection = "flat",
    subtext,
    icon: Icon,
    iconColor = "text-primary",
    className,
}: MetricCardProps) {
    const trendColor =
        trendDirection === "up"
            ? "text-emerald-500 bg-emerald-50"
            : trendDirection === "down"
                ? "text-rose-500 bg-rose-50"
                : "text-gray-500 bg-gray-50";

    const TrendIcon =
        trendDirection === "up"
            ? ArrowUp
            : trendDirection === "down"
                ? ArrowDown
                : Minus;

    return (
        <div className={cn("rounded-2xl bg-white p-6 shadow-sm border border-gray-100", className)}>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-500">{label}</p>
                        {scopeLabel ? (
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                {scopeLabel}
                            </span>
                        ) : null}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
                </div>
                {Icon && (
                    <div className={cn("p-2 rounded-lg bg-gray-50", iconColor)}>
                        <Icon className="w-5 h-5" />
                    </div>
                )}
            </div>

            {(trend || subtext) && (
                <div className="flex items-center gap-2 text-xs">
                    {trend && (
                        <span
                            className={cn(
                                "flex items-center gap-1 px-2 py-0.5 rounded-full font-medium",
                                trendColor
                            )}
                        >
                            <TrendIcon className="w-3 h-3" />
                            {trend}
                        </span>
                    )}
                    {subtext && <span className="text-gray-400">{subtext}</span>}
                </div>
            )}
        </div>
    );
}
