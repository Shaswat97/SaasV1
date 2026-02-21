"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { AlertTriangle, Archive, TrendingDown } from "lucide-react";

type InventoryRisk = {
    id: string;
    sku: string;
    name: string;
    riskType: "STOCKOUT" | "DEAD_STOCK";
    metric: string; // e.g. "2 Days Cover" or "90 Days Idle"
};

type InventoryHealthCardProps = {
    risks: InventoryRisk[];
    deadStockCount: number;
    stockoutCount: number;
    className?: string;
};

export function InventoryHealthCard({ risks, deadStockCount, stockoutCount, className }: InventoryHealthCardProps) {
    return (
        <Card className={`border-none shadow-sm bg-white rounded-2xl ${className}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-amber-500" />
                        Inventory Health
                    </CardTitle>
                </div>
            </CardHeader>
            <CardBody className="pt-2">
                <div className="flex gap-4 mb-6">
                    <div className="flex-1 bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                        <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Stockout Risk</p>
                        <p className="text-2xl font-bold text-red-700">{stockoutCount}</p>
                    </div>
                    <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Dead Stock</p>
                        <p className="text-2xl font-bold text-gray-700">{deadStockCount}</p>
                    </div>
                </div>

                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top Risks</h4>
                <div className="flex flex-col gap-3">
                    {risks.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-md ${item.riskType === 'STOCKOUT' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
                                    }`}>
                                    {item.riskType === 'STOCKOUT' ? <AlertTriangle className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{item.sku}</p>
                                    <p className="text-xs text-gray-500 truncate max-w-[120px]">{item.name}</p>
                                </div>
                            </div>
                            <Badge
                                label={item.metric}
                                variant={item.riskType === 'STOCKOUT' ? 'danger' : 'neutral'}
                                className="text-[10px] px-1.5 py-0.5 h-6"
                            />
                        </div>
                    ))}
                    {risks.length === 0 && (
                        <div className="text-center text-gray-400 text-xs py-2">No inventory risks detected.</div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
