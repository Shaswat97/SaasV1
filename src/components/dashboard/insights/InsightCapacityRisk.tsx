"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Activity, Calendar, User, Zap } from "lucide-react";

type MachineRisk = {
    id: string;
    name: string;
    load: number;
    requiredHrs: number;
    risk: "High" | "Medium" | "Low";
    status: "Critical" | "Warning" | "Stable";
    shifts: { shift: string; load: number; operator: string }[];
    maintenance: string;
};

const machineData: MachineRisk[] = [
    {
        id: "M-02",
        name: "Hydraulic Press",
        load: 94.5,
        requiredHrs: 47.4,
        risk: "High",
        status: "Critical",
        shifts: [
            { shift: "Shift A (Morning)", load: 98, operator: "Ravi K." },
            { shift: "Shift B (Evening)", load: 91, operator: "Amit S." },
        ],
        maintenance: "Overdue (Last: 20 days ago)"
    },
    {
        id: "M-01",
        name: "CNC Lathe",
        load: 82.1,
        requiredHrs: 38.2,
        risk: "Medium",
        status: "Warning",
        shifts: [
            { shift: "Shift A (Morning)", load: 85, operator: "Vikram R." },
            { shift: "Shift B (Evening)", load: 79, operator: "Suresh P." },
        ],
        maintenance: "Scheduled in 3 days"
    },
    {
        id: "M-INJ",
        name: "Injection Molder",
        load: 45.0,
        requiredHrs: 12.0,
        risk: "Low",
        status: "Stable",
        shifts: [
            { shift: "Shift A (Morning)", load: 45, operator: "Auto Mode" },
        ],
        maintenance: "Up to date"
    }
];

export function InsightCapacityRisk() {
    const [selectedId, setSelectedId] = useState<string>(machineData[0].id);
    const selectedMachine = machineData.find(m => m.id === selectedId) || machineData[0];

    return (
        <div className="flex h-full gap-6">
            {/* Master List */}
            <div className="w-1/3 border-r border-gray-100 pr-6 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Machine Load (7d)</h3>
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
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-bold text-sm ${selectedId === item.id ? "text-blue-700" : "text-gray-900"}`}>
                                    {item.name}
                                </span>
                                <Badge variant={item.risk === "High" ? "danger" : item.risk === "Medium" ? "warning" : "neutral"} label={item.risk} className="text-[10px]" />
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                                <span>Load: <span className="font-mono font-bold text-gray-900">{item.load}%</span></span>
                                <span>Req: {item.requiredHrs}h</span>
                            </div>
                            {/* Mini Progress Bar */}
                            <div className="w-full h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
                                <div
                                    className={`h-full ${item.load > 90 ? "bg-red-500" : item.load > 80 ? "bg-orange-400" : "bg-green-500"}`}
                                    style={{ width: `${item.load}%` }}
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
                        <h2 className="text-2xl font-serif font-bold text-gray-900">{selectedMachine.name}</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Zap className="w-4 h-4 text-amber-500" /> {selectedMachine.status} Load</span>
                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-blue-500" /> {selectedMachine.maintenance}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Capacity Utilization</div>
                        <div className={`text-3xl font-bold ${selectedMachine.load > 90 ? "text-red-600" : "text-gray-900"}`}>{selectedMachine.load}%</div>
                    </div>
                </div>

                {/* Shift Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {selectedMachine.shifts.map((shift, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-gray-900 text-sm">{shift.shift}</span>
                                <Badge variant="neutral" label={shift.operator} />
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-2xl font-bold text-gray-800">{shift.load}%</span>
                                <span className="text-xs text-gray-500 mb-1">load factor</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Recommendation */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <Activity className="w-5 h-5" /> Capacity Optimization
                    </h4>
                    <p className="text-sm text-blue-800 leading-relaxed">
                        {selectedMachine.load > 90
                            ? `This machine is running near maximum capacity defined by the manufacturer. Consider offloading ${Math.round(selectedMachine.requiredHrs * 0.1)} hours to the backup unit or scheduling an overtime shift to prevent thermal throttling.`
                            : "Machine is operating within safe parameters. No immediate action required."}
                    </p>
                </div>

            </div>
        </div>
    );
}
