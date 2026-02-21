"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { ArrowUp } from "lucide-react";

interface RevenueChartProps {
    data: Array<{ label: string; value: number; previous?: number }>;
    totalValue: string;
    trend: string;
    height?: number;
}

export function RevenueChart({ data, totalValue, trend, height = 300 }: RevenueChartProps) {
    return (
        <Card className="border-none shadow-sm h-full bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                    <p className="text-sm font-medium text-gray-500">Total Profit</p>
                    <div className="flex items-end gap-3 mt-1">
                        <h3 className="text-3xl font-bold text-gray-900">{totalValue}</h3>
                        <span className="flex items-center gap-1 text-sm font-medium text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">
                            <ArrowUp className="w-3 h-3" />
                            {trend}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">vs. last period</p>
                </div>

                {/* Legend / Key could go here if needed */}
                <div className="flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="text-gray-600">This month</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                        <span className="text-gray-600">Last month</span>
                    </div>
                </div>
            </CardHeader>

            <CardBody className="p-0">
                <div className="w-full" style={{ height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#9ca3af", fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#9ca3af", fontSize: 12 }}
                                tickFormatter={(value) => `${value / 1000}k`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "#fff",
                                    borderRadius: "12px",
                                    border: "none",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                                }}
                                cursor={{ stroke: "#3b82f6", strokeWidth: 1, strokeDasharray: "4 4" }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                            <Line
                                type="monotone"
                                dataKey="previous"
                                stroke="#e5e7eb"
                                strokeWidth={2}
                                dot={false}
                                strokeDasharray="4 4"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardBody>
        </Card>
    );
}
