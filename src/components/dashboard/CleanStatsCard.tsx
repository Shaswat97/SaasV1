import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/Card";

type CleanStatsCardProps = {
    label: string;
    value: string;
    icon: LucideIcon;
    trend?: string;
    trendDirection?: "up" | "down" | "flat";
    color?: "blue" | "green" | "orange" | "purple";
    className?: string;
};

const colors = {
    blue: "text-blue-500 bg-blue-500/10",
    green: "text-emerald-500 bg-emerald-500/10",
    orange: "text-orange-500 bg-orange-500/10",
    purple: "text-purple-500 bg-purple-500/10",
};

export function CleanStatsCard({
    label,
    value,
    icon: Icon,
    trend,
    trendDirection,
    color = "blue",
    className,
}: CleanStatsCardProps) {
    return (
        <Card className={cn("border-none shadow-sm hover:shadow-md transition bg-surface", className)}>
            <CardBody className="flex items-center gap-4 p-5">
                <div className={cn("rounded-xl p-3", colors[color])}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-sm font-medium text-text-muted">{label}</p>
                    <div className="flex items-baseline gap-2">
                        <h4 className="text-xl font-bold text-text">{value}</h4>
                        {trend && (
                            <span className={cn(
                                "text-xs font-medium",
                                trendDirection === "up" ? "text-emerald-500" : trendDirection === "down" ? "text-red-500" : "text-text-muted"
                            )}>
                                {trend}
                            </span>
                        )}
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
