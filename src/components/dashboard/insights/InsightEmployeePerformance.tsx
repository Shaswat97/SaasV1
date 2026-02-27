"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { User, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react";

type EmployeePerf = {
    id: string;
    name: string;
    role: string;
    rating: number;
    efficiency: number;
    qualityScore: number;
    attendance: number;
    trend: "up" | "down" | "flat";
    recentLogs: { date: string; action: string; impact: "positive" | "negative" | "neutral" }[];
    summary: string;
};

const employeeData: EmployeePerf[] = [
    {
        id: "EMP-01",
        name: "Riya Sharma",
        role: "Senior Operator",
        rating: 9.2,
        efficiency: 94,
        qualityScore: 98,
        attendance: 100,
        trend: "up",
        recentLogs: [
            { date: "Today, 10:00 AM", action: "Completed Batch B-2026-X99 ahead of schedule", impact: "positive" },
            { date: "Yesterday", action: "Identified calibration error in CNC Lathe", impact: "positive" },
        ],
        summary: "Top performer of the month. consistently exceeds output targets while maintaining near-perfect quality standards."
    },
    {
        id: "EMP-04",
        name: "Amit Patel",
        role: "Assembly Tech",
        rating: 8.5,
        efficiency: 88,
        qualityScore: 92,
        attendance: 95,
        trend: "flat",
        recentLogs: [
            { date: "Today, 09:15 AM", action: "Regular maintenance check completed", impact: "neutral" },
        ],
        summary: "Consistent performance. Demonstrates strong technical skills but could improve on changeover times."
    },
    {
        id: "EMP-09",
        name: "Vikram Singh",
        role: "Junior Operator",
        rating: 7.1,
        efficiency: 76,
        qualityScore: 85,
        attendance: 90,
        trend: "down",
        recentLogs: [
            { date: "Yesterday", action: "Minor safety violation (PPE)", impact: "negative" },
            { date: "Feb 14", action: "Slower than average cycle time on M-02", impact: "negative" },
        ],
        summary: "Requires additional training on safety protocols and machine setup to improve efficiency."
    }
];

export function InsightEmployeePerformance() {
    const [selectedId, setSelectedId] = useState<string>(employeeData[0].id);
    const selectedEmp = employeeData.find(e => e.id === selectedId) || employeeData[0];

    return (
        <div className="flex h-full gap-6">
            {/* Master List */}
            <div className="w-1/3 border-r border-gray-100 pr-6 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Workforce (Shift A)</h3>
                <div className="space-y-3">
                    {employeeData.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${selectedId === item.id
                                ? "bg-purple-50 border-purple-200 shadow-sm"
                                : "bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold text-sm ${selectedId === item.id ? "text-purple-700" : "text-gray-900"}`}>
                                    {item.name}
                                </span>
                                <div className="flex items-center gap-1">
                                    <Badge
                                        variant={item.rating >= 9 ? "success" : item.rating >= 7 ? "warning" : "danger"}
                                        label={item.rating.toString()}
                                        className="font-mono"
                                    />
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">{item.role}</div>
                            <div className="w-full h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
                                <div
                                    className={`h-full ${item.rating >= 9 ? "bg-green-500" : item.rating >= 7 ? "bg-yellow-400" : "bg-red-500"}`}
                                    style={{ width: `${item.rating * 10}%` }}
                                />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Detail View */}
            <div className="flex-1 overflow-y-auto pl-2">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-gray-900">{selectedEmp.name}</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><User className="w-4 h-4 text-purple-500" /> {selectedEmp.role}</span>
                            <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-blue-500" /> {selectedEmp.attendance}% Attendance</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Overall Rating</div>
                        <div className="text-3xl font-bold text-gray-900">{selectedEmp.rating}<span className="text-sm text-gray-400 font-normal">/10</span></div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                        <div className="text-sm text-purple-600 font-medium mb-1">Efficiency</div>
                        <div className="text-2xl font-bold text-purple-900">{selectedEmp.efficiency}%</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                        <div className="text-sm text-green-600 font-medium mb-1">Quality Score</div>
                        <div className="text-2xl font-bold text-green-900">{selectedEmp.qualityScore}%</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="text-sm text-blue-600 font-medium mb-1">Performance Trend</div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className={`w-5 h-5 ${selectedEmp.trend === "up" ? "text-green-600" : selectedEmp.trend === "down" ? "text-red-500" : "text-gray-500"}`} />
                            <span className="text-lg font-bold text-blue-900 capitalize">{selectedEmp.trend}</span>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-6">
                    <h4 className="font-bold text-gray-900 mb-4">Recent Activity Log</h4>
                    <div className="space-y-4">
                        {selectedEmp.recentLogs.map((log, idx) => (
                            <div key={idx} className="flex gap-4 items-start">
                                <div className={`mt-1 ${log.impact === "positive" ? "text-green-500" : log.impact === "negative" ? "text-red-500" : "text-gray-400"}`}>
                                    {log.impact === "positive" ? <CheckCircle className="w-5 h-5" /> : log.impact === "negative" ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{log.action}</p>
                                    <p className="text-xs text-gray-500">{log.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Automated Feedback */}
                <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-900 mb-2">Automated Feedback</h4>
                    <p className="text-sm text-gray-600 leading-relaxed italic">
                        &quot;{selectedEmp.summary}&quot;
                    </p>
                </div>

            </div>
        </div>
    );
}
