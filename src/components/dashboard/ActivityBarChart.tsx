"use client";

import {
    BarChart,
    Bar,
    XAxis,
    ResponsiveContainer,
    Cell,
    Tooltip,
} from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { MoreHorizontal } from "lucide-react";

interface ActivityBarChartProps {
    data: Array<{ day: string; value: number }>;
    activeDay?: string;
    height?: number;
}

export function ActivityBarChart({ data, activeDay = "Tue", height = 200 }: ActivityBarChartProps) {
    return (
        <Card className="border-none shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold text-gray-900">Most Day Active</CardTitle>
                <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            </CardHeader>
            <CardBody>
                <div className="flex flex-col items-center justify-center mb-4">
                    <span className="text-3xl font-bold text-gray-900">8,162</span>
                    <span className="text-xs text-gray-400">Views on {activeDay}</span>
                </div>
                <div style={{ height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} barSize={24}>
                            <XAxis
                                dataKey="day"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#9ca3af", fontSize: 12 }}
                                dy={10}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.day === activeDay ? "#3b82f6" : "#f3f4f6"}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardBody>
        </Card>
    );
}
