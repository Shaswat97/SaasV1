"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { AlertTriangle, TrendingDown, Users, Clock, ArrowRight } from "lucide-react";

type LossItem = {
    id: string;
    sku: string;
    name: string;
    lossCost: string;
    lossQty: number;
    primaryReason: string;
    rootCauses: { reason: string; pct: number; color: string }[];
    timeline: { time: string; event: string; type: "error" | "info" }[];
    operator: string;
    batchId: string;
};

const lossData: LossItem[] = [
    {
        id: "FG-01",
        sku: "FG-01",
        name: "Precision Housing",
        lossCost: "₹4,200",
        lossQty: 21,
        primaryReason: "Dimensional Deviation",
        rootCauses: [
            { reason: "Dimensional Deviation", pct: 60, color: "bg-red-500" },
            { reason: "Surface Scratch", pct: 30, color: "bg-orange-500" },
            { reason: "Material Defect", pct: 10, color: "bg-gray-400" },
        ],
        timeline: [
            { time: "10:15 AM", event: "Batch Start - Operator A", type: "info" },
            { time: "11:30 AM", event: "Sensor Drift Detected", type: "error" },
            { time: "11:45 AM", event: "5 Units Rejected (Out of Spec)", type: "error" },
            { time: "12:00 PM", event: "Recalibration Performed", type: "info" },
        ],
        operator: "Rajesh Kumar (Shift A)",
        batchId: "B-2026-X99"
    },
    {
        id: "FG-02",
        sku: "FG-02",
        name: "Hydraulic Bracket",
        lossCost: "₹3,800",
        lossQty: 18,
        primaryReason: "Casting Porosity",
        rootCauses: [
            { reason: "Casting Porosity", pct: 80, color: "bg-red-500" },
            { reason: "Machining Error", pct: 20, color: "bg-blue-500" },
        ],
        timeline: [
            { time: "09:00 AM", event: "Molding Process Start", type: "info" },
            { time: "02:20 PM", event: "Quality Check Failed (Air pockets)", type: "error" },
        ],
        operator: "Sunil V. (Shift B)",
        batchId: "B-2026-Y10"
    },
    {
        id: "FG-104",
        sku: "FG-104",
        name: "Insulated Cable Roll",
        lossCost: "₹1,200",
        lossQty: 8,
        primaryReason: "Insulation Damage",
        rootCauses: [
            { reason: "Insulation Tear", pct: 100, color: "bg-red-500" },
        ],
        timeline: [],
        operator: "Autolines System",
        batchId: "C-9901"
    }
];

export function InsightLossAnalysis() {
    const [selectedId, setSelectedId] = useState<string>(lossData[0].id);
    const selectedItem = lossData.find(item => item.id === selectedId) || lossData[0];

    return (
        <div className="flex h-full gap-6">
            {/* Master List (Left Sidebar) */}
            <div className="w-1/3 border-r border-gray-100 pr-6 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Top Loss Drivers</h3>
                <div className="space-y-3">
                    {lossData.map((item) => (
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
                                    {item.sku}
                                </span>
                                <span className="text-red-600 font-mono font-bold">{item.lossCost}</span>
                            </div>
                            <div className="text-xs text-gray-500 truncate mb-2">{item.name}</div>
                            <Badge variant="danger" label={`${item.lossQty} units`} className="text-[10px] px-1.5 py-0.5" />
                        </button>
                    ))}
                </div>
            </div>

            {/* Detail View (Right Content) */}
            <div className="flex-1 overflow-y-auto pl-2">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-gray-900">{selectedItem.name} ({selectedItem.sku})</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500" /> {selectedItem.primaryReason}</span>
                            <span className="flex items-center gap-1"><Users className="w-4 h-4 text-blue-500" /> {selectedItem.operator}</span>
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{selectedItem.batchId}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Total Loss Impact</div>
                        <div className="text-3xl font-bold text-red-600">{selectedItem.lossCost}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Root Cause Analysis */}
                    <div className="bg-gray-50 rounded-2xl p-6">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-gray-700" /> Root Cause Breakdown
                        </h4>
                        <div className="space-y-4">
                            {selectedItem.rootCauses.map((cause, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-gray-700">{cause.reason}</span>
                                        <span className="font-bold text-gray-900">{cause.pct}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                        <div className={`h-full ${cause.color}`} style={{ width: `${cause.pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-gray-700" /> Incident Timeline
                        </h4>
                        <div className="space-y-6 relative pl-2">
                            {/* Vertical Line */}
                            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-100" />

                            {selectedItem.timeline.length > 0 ? selectedItem.timeline.map((event, idx) => (
                                <div key={idx} className="relative flex gap-4 items-start">
                                    <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 z-10 ${event.type === "error" ? "bg-red-500 ring-2 ring-red-100" : "bg-blue-500 ring-2 ring-blue-100"}`} />
                                    <div>
                                        <div className="text-xs font-mono text-gray-400 mb-0.5">{event.time}</div>
                                        <div className={`text-sm font-medium ${event.type === "error" ? "text-red-700" : "text-gray-700"}`}>
                                            {event.event}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-sm text-gray-400 italic">No timeline events recorded.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Items */}
                <div className="mt-8 bg-purple-50 border border-purple-100 rounded-2xl p-6">
                    <h4 className="font-bold text-purple-900 mb-2">Recommended Actions</h4>
                    <ul className="text-sm text-purple-800 space-y-2">
                        <li className="flex items-start gap-2">
                            <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-purple-500" />
                            Check calibration logs for CNC Lathe regarding &quot;{selectedItem.primaryReason}&quot;.
                        </li>
                        <li className="flex items-start gap-2">
                            <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-purple-500" />
                            Review operator training for {selectedItem.operator.split('(')[0]}.
                        </li>
                    </ul>
                </div>

            </div>
        </div>
    );
}
