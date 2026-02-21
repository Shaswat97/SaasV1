import { LucideIcon } from "lucide-react";

type StatPillProps = {
    label: string;
    value: string;
    icon: LucideIcon;
    color: "green" | "blue" | "orange";
    subtext?: string;
};

const variants = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
};

export function QuickStatPill({ label, value, icon: Icon, color, subtext }: StatPillProps) {
    return (
        <div className={`flex flex-1 flex-col justify-between rounded-[1.5rem] p-5 ${variants[color]}`}>
            <div className="flex items-start justify-between">
                <div className="rounded-full bg-white p-2 shadow-sm">
                    <Icon className="h-5 w-5 opacity-80" />
                </div>
                {/* Mini Sparkline placeholder or arrow */}
            </div>
            <div className="mt-4">
                <p className="text-sm font-medium opacity-70 mb-1">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
                {subtext && <p className="mt-1 text-xs font-medium opacity-80">{subtext}</p>}
            </div>
        </div>
    );
}
