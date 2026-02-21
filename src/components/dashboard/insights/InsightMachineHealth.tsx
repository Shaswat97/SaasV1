"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Gauge, Activity, AlertTriangle, CheckCircle, Power } from "lucide-react";

type MachineHealth = {
    id: string;
    name: string;
    status: "Running" | "Down" | "Idle";
    oee: number;
    availability: number;
    performance: number;
    quality: number;
    downtimeReason?: string;
    lastMaintenance: string;
};

const machineData: MachineHealth[] = [
    {
        id: "M-01",
        name: "CNC Milling Station A",
        status: "Running",
        oee: 87,
        availability: 92,
        performance: 85,
        quality: 98,
        lastMaintenance: "3 days ago"
    },
    {
        id: "M-02",
        name: "Hydraulic Press 50T",
        status: "Down",
        oee: 45,
        availability: 50,
        performance: 80,
        quality: 90,
        downtimeReason: "Hydraulic Fluid Leak",
        lastMaintenance: "Overdue (15 days)"
    },
    {
        id: "M-03",
        name: "Laser Cutter X1",
        status: "Running",
        oee: 92,
        availability: 95,
        performance: 94,
        quality: 99,
        lastMaintenance: "1 week ago"
    },
    {
        id: "M-04",
        name: "Assembly Robot R2",
        status: "Idle",
        oee: 78,
        availability: 80,
        performance: 75,
        quality: 100,
        downtimeReason: "Waiting for parts",
        lastMaintenance: "2 days ago"
    }
];

export function InsightMachineHealth() {
    const [selectedId, setSelectedId] = useState<string>(machineData[0].id);
    const selectedMachine = machineData.find(m => m.id === selectedId) || machineData[0];

    return (
        <div className="flex h-full gap-6">
            {/* Master List */}
            <div className="w-1/3 border-r border-gray-100 pr-6 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Machine Status</h3>
                <div className="space-y-3">
                    {machineData.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${selectedId === item.id
                                    ? "bg-blue-50 border-blue-200 shadow-sm"
                                    : "bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold text-sm ${selectedId === item.id ? "text-blue-700" : "text-gray-900"}`}>
                                    {item.name}
                                </span>
                                <Badge
                                    variant={item.status === "Running" ? "success" : item.status === "Down" ? "danger" : "warning"}
                                    label={item.status}
                                    className="px-1.5 py-0.5 text-[10px]"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-500">OEE Score:</span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${item.oee >= 85 ? "bg-green-500" : item.oee >= 60 ? "bg-yellow-400" : "bg-red-500"}`}
                                        style={{ width: `${item.oee}%` }}
                                    />
                                </div>
                                <span className="text-xs font-bold text-gray-700">{item.oee}%</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Detail View */}
            <div className="flex-1 overflow-y-auto pl-2">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-gray-900">{selectedMachine.name}</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <Power className={`w-4 h-4 ${selectedMachine.status === "Running" ? "text-green-500" : selectedMachine.status === "Down" ? "text-red-500" : "text-amber-500"}`} />
                                Status: <span className="font-semibold">{selectedMachine.status}</span>
                            </span>
                            <span className="text-gray-400">|</span>
                            <span>Maint: {selectedMachine.lastMaintenance}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Overall OEE</div>
                        <div className="text-3xl font-bold text-blue-900">{selectedMachine.oee}%</div>
                    </div>
                </div>

                {selectedMachine.status !== "Running" && (
                    <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${selectedMachine.status === "Down" ? "bg-red-50 border-red-100 text-red-700" : "bg-amber-50 border-amber-100 text-amber-700"}`}>
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>
                            <span className="font-bold">Attention Needed:</span> {selectedMachine.downtimeReason || "Machine is currently idle."}
                        </div>
                    </div>
                )}

                {/* OEE Breakdown Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm flex flex-col items-center text-center">
                        <div className="text-gray-500 text-xs uppercase tracking-wide font-bold mb-2">Availability</div>
                        <div className="relative w-20 h-20 mb-2 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="40" cy="40" r="36" className="text-gray-100" strokeWidth="8" fill="none" stroke="currentColor" />
                                <circle cx="40" cy="40" r="36" className="text-blue-500" strokeWidth="8" fill="none" stroke="currentColor" strokeDasharray={`${selectedMachine.availability * 2.26} 226`} />
                            </svg>
                            <span className="absolute text-lg font-bold text-gray-800">{selectedMachine.availability}%</span>
                        </div>
                        <div className="text-xs text-gray-400">Run Time / Planned Time</div>
                    </div>

                    <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm flex flex-col items-center text-center">
                        <div className="text-gray-500 text-xs uppercase tracking-wide font-bold mb-2">Performance</div>
                        <div className="relative w-20 h-20 mb-2 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="40" cy="40" r="36" className="text-gray-100" strokeWidth="8" fill="none" stroke="currentColor" />
                                <circle cx="40" cy="40" r="36" className="text-purple-500" strokeWidth="8" fill="none" stroke="currentColor" strokeDasharray={`${selectedMachine.performance * 2.26} 226`} />
                            </svg>
                            <span className="absolute text-lg font-bold text-gray-800">{selectedMachine.performance}%</span>
                        </div>
                        <div className="text-xs text-gray-400">Actual / Target Output</div>
                    </div>

                    <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-sm flex flex-col items-center text-center">
                        <div className="text-gray-500 text-xs uppercase tracking-wide font-bold mb-2">Quality</div>
                        <div className="relative w-20 h-20 mb-2 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="40" cy="40" r="36" className="text-gray-100" strokeWidth="8" fill="none" stroke="currentColor" />
                                <circle cx="40" cy="40" r="36" className="text-green-500" strokeWidth="8" fill="none" stroke="currentColor" strokeDasharray={`${selectedMachine.quality * 2.26} 226`} />
                            </svg>
                            <span className="absolute text-lg font-bold text-gray-800">{selectedMachine.quality}%</span>
                        </div>
                        <div className="text-xs text-gray-400">Good Yield / Total</div>
                    </div>
                </div>

                {/* Diagnosis */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <Activity className="w-5 h-5" /> AI Diagnostic
                    </h4>
                    <p className="text-sm text-blue-800 leading-relaxed">
                        {selectedMachine.oee < 60
                            ? "CRITICAL: This machine is causing a bottleneck. The primary issue is availability due to unplanned downtime. Immediate maintenance intervention recommended."
                            : selectedMachine.oee < 85
                                ? "WARNING: Performance efficiency is lagging. Check for micro-stops or speed losses during the shift."
                                : "OPTIMAL: Running at peak efficiency. No action required."}
                    </p>
                </div>

            </div>
        </div>
    );
}
