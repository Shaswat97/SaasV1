"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { MoreHorizontal } from "lucide-react";

interface RetentionGaugeProps {
    value: number; // 0 to 100
    label?: string;
}

export function RetentionGauge({ value, label = "On track for 80% target" }: RetentionGaugeProps) {
    const data = [
        { name: "Progress", value: value },
        { name: "Remaining", value: 100 - value },
    ];

    // Colors: Emerald for progress, Light Gray for subtle track
    const COLORS = ["#10b981", "#f3f4f6"];

    return (
        <Card className="border-none shadow-sm bg-white rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold text-gray-900">Repeat Customer Rate</CardTitle>
                <button className="text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-5 h-5" />
                </button>
            </CardHeader>
            <CardBody className="flex flex-col items-center justify-center relative">
                <div style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="70%"
                                startAngle={180}
                                endAngle={0}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={0}
                                dataKey="value"
                                cornerRadius={10}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Center Text positioned absolutely to be in the middle of the gauge semi-circle */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-0 text-center mt-6">
                    <h3 className="text-3xl font-bold text-gray-900">{value}%</h3>
                    <p className="text-xs text-gray-400 mt-1 whitespace-nowrap">{label}</p>
                </div>

                <button className="mt-4 px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
                    Show details
                </button>
            </CardBody>
        </Card>
    );
}
