import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type HeroStatsCardProps = {
    label: string;
    value: string;
    trend?: string; // e.g., "+12%"
    trendDirection?: "up" | "down" | "flat";
    icon: LucideIcon;
    variant?: "primary" | "orange" | "blue" | "green";
    className?: string;
    subtext?: string;
};

const variants = {
    primary: "bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] text-white", // Vibrant Purple/Pink
    orange: "bg-gradient-to-br from-orange-500 to-red-500 text-white",
    blue: "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
    green: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
};

export function HeroStatsCard({
    label,
    value,
    trend,
    trendDirection,
    icon: Icon,
    variant = "primary",
    className,
    subtext
}: HeroStatsCardProps) {
    return (
        <div className={cn("relative overflow-hidden rounded-2xl p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-xl", variants[variant], className)}>
            <div className="relative z-10 flex flex-col justify-between h-full gap-4">
                <div className="flex items-start justify-between">
                    <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                    {trend && (
                        <div className="flex items-center gap-1 text-sm font-medium bg-white/10 px-2 py-1 rounded-lg backdrop-blur-sm">
                            <span>{trendDirection === "up" ? "↑" : trendDirection === "down" ? "↓" : "→"}</span>
                            <span>{trend}</span>
                        </div>
                    )}
                </div>

                <div>
                    <p className="text-sm font-medium text-white/80 uppercase tracking-wide">{label}</p>
                    <h3 className="mt-1 text-3xl font-bold tracking-tight text-white">{value}</h3>
                    {subtext && <p className="mt-1 text-xs text-white/60">{subtext}</p>}
                </div>
            </div>

            {/* Decorative Circles */}
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </div>
    );
}
