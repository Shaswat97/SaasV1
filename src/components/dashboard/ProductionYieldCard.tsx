"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Layers } from "lucide-react";

type ProductionYieldProps = {
    data: {
        good: number;
        reject: number;
        scrap: number;
    };
    todayTotal: number;
    className?: string;
};

export function ProductionYieldCard({ data, todayTotal, className }: ProductionYieldProps) {
    const chartData = [
        { name: "Good", value: data.good, color: "#10b981" }, // emerald-500
        { name: "Reject", value: data.reject, color: "#f59e0b" }, // amber-500
        { name: "Scrap", value: data.scrap, color: "#ef4444" }, // red-500
    ];

    // Filter out zero values to avoid empty segments or weird rendering
    const activeData = chartData.filter(d => d.value > 0);

    return (
        <Card className={`border-none shadow-sm bg-white rounded-2xl ${className}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Layers className="w-5 h-5 text-purple-500" />
                        Production Output
                    </CardTitle>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {todayTotal.toLocaleString()} units
                    </span>
                </div>
            </CardHeader>
            <CardBody className="pt-2 flex flex-col items-center">
                <div className="h-[180px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={activeData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {activeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: any) => [value?.toLocaleString(), 'Units']}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-bold text-gray-900">
                            {data.good > 0 ? Math.round((data.good / todayTotal) * 100) : 0}%
                        </span>
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Yield</span>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-6 mt-4 w-full">
                    {chartData.map((item) => (
                        <div key={item.name} className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-gray-500">{item.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{item.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}
