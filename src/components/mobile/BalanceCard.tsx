"use client";

import { TrendChart } from "@/components/dashboard/TrendChart";
import { ArrowUpRight } from "lucide-react";

type BalanceCardProps = {
    label: string;
    amount: string;
    trend: string;
    trendDirection?: "up" | "down";
    data: Array<{ label: string; value: number }>;
};

export function BalanceCard({ label, amount, trend, data }: BalanceCardProps) {
    return (
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] p-6 text-white shadow-xl shadow-purple-500/20">
            <div className="relative z-10 flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-white/80">{label}</p>
                        <h2 className="mt-1 text-4xl font-bold tracking-tight">{amount}</h2>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
                        <ArrowUpRight className="h-3 w-3" />
                        {trend}
                    </div>
                </div>

                {/* Chart Area */}
                <div className="h-16 w-full opacity-80">
                    {/* Reusing existing TrendChart but forcing white color */}
                    <TrendChart data={data} color="#ffffff" height={64} />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs font-medium text-white/70">
                    <span>Updated just now</span>
                    <span>**** 8969</span>
                </div>
            </div>

            {/* Decorative blobs */}
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        </div>
    );
}
