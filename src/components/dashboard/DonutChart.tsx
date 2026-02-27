"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type DonutChartProps = {
    data: Array<{ name: string; value: number; color: string }>;
    height?: number;
    innerRadius?: number;
    outerRadius?: number;
    centerLabel?: string;
    centerSubLabel?: string;
};

export function DonutChart({
    data,
    height = 160,
    innerRadius = 60,
    outerRadius = 80,
    centerLabel,
    centerSubLabel,
}: DonutChartProps) {
    return (
        <div style={{ height, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius={outerRadius}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#1e1b4b",
                            border: "none",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                        itemStyle={{ color: "#e0e7ff", fontSize: "12px", fontWeight: 500 }}
                        formatter={(value: any) => [value, ""]}
                    />
                </PieChart>
            </ResponsiveContainer>
            {(centerLabel || centerSubLabel) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {centerLabel && <span className="text-2xl font-bold text-text">{centerLabel}</span>}
                    {centerSubLabel && <span className="text-xs text-text-muted uppercase tracking-wider">{centerSubLabel}</span>}
                </div>
            )}
        </div>
    );
}
