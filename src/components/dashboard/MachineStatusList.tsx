"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Activity, Power, AlertCircle } from "lucide-react";

type MachineStatus = {
    id: string;
    code: string;
    name: string;
    status: "RUNNING" | "IDLE" | "DOWN";
    oee: number;
    lastRun?: string;
    utilization: number;
};

type MachineStatusListProps = {
    machines: MachineStatus[];
    className?: string;
};

export function MachineStatusList({ machines, className }: MachineStatusListProps) {
    return (
        <Card className={`border-none shadow-sm bg-white rounded-2xl ${className}`}>
            <CardHeader className="pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Machine Status
                    </CardTitle>
                    <Badge label={`${machines.filter(m => m.status === 'RUNNING').length} Active`} variant="success" className="bg-green-100 text-green-700 border-green-200" />
                </div>
            </CardHeader>
            <CardBody className="pt-0 p-0">
                <div className="divide-y divide-gray-50">
                    {machines.map((machine) => (
                        <div key={machine.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-xl ${machine.status === 'RUNNING' ? 'bg-green-100 text-green-600' :
                                        machine.status === 'DOWN' ? 'bg-red-100 text-red-600' :
                                            'bg-gray-100 text-gray-500'
                                    }`}>
                                    <Power className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 text-sm">{machine.name}</h4>
                                    <p className="text-xs text-gray-500">{machine.code} • {machine.status}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 mb-1">OEE</p>
                                    <span className={`font-mono font-medium ${machine.oee >= 85 ? 'text-green-600' :
                                            machine.oee >= 70 ? 'text-amber-600' :
                                                'text-red-600'
                                        }`}>
                                        {machine.oee}%
                                    </span>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs text-gray-500 mb-1">Utilization</p>
                                    <span className="font-mono font-medium text-gray-700">{machine.utilization}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {machines.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            No machines configured.
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
