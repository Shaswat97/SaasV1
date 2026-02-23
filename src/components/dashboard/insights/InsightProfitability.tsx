"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { DollarSign, PieChart, TrendingUp, Layers } from "lucide-react";

type SKUProfit = {
    id: string;
    name: string;
    sku: string;
    margin: number;
    revenue: string;
    costStructure: { type: string; value: number; color: string }[];
    unitEconomics: { price: number; cost: number; profit: number };
    trend: "up" | "down" | "flat";
};

const profitData: SKUProfit[] = [
    {
        id: "FG-05",
        name: "Aero Bracket",
        sku: "FG-05",
        margin: 42,
        revenue: "₹45,000",
        costStructure: [
            { type: "Material", value: 30, color: "bg-blue-500" },
            { type: "Labor", value: 15, color: "bg-purple-500" },
            { type: "Overhead", value: 13, color: "bg-gray-400" },
            { type: "Margin", value: 42, color: "bg-green-500" },
        ],
        unitEconomics: { price: 1200, cost: 696, profit: 504 },
        trend: "up"
    },
    {
        id: "FG-99",
        name: "Legacy Widget",
        sku: "FG-99",
        margin: 4,
        revenue: "₹1,200",
        costStructure: [
            { type: "Material", value: 55, color: "bg-blue-500" },
            { type: "Labor", value: 30, color: "bg-purple-500" },
            { type: "Overhead", value: 11, color: "bg-gray-400" },
            { type: "Margin", value: 4, color: "bg-green-500" },
        ],
        unitEconomics: { price: 450, cost: 432, profit: 18 },
        trend: "down"
    },
];

export function InsightProfitability() {
    const [selectedId, setSelectedId] = useState<string>(profitData[0].id);
    const selectedItem = profitData.find(p => p.id === selectedId) || profitData[0];

    return (
        <div className="flex h-full gap-6">
            {/* Master List */}
            <div className="w-1/3 border-r border-gray-100 pr-6 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">SKU Performance</h3>
                <div className="space-y-3">
                    {profitData.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${selectedId === item.id
                                    ? "bg-green-50 border-green-200 shadow-sm"
                                    : "bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold text-sm ${selectedId === item.id ? "text-green-800" : "text-gray-900"}`}>
                                    {item.sku}
                                </span>
                                <span className={`font-mono font-bold ${item.margin > 20 ? "text-green-600" : "text-red-500"}`}>
                                    {item.margin}%
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">{item.name}</div>
                            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                <DollarSign className="w-3 h-3" /> {item.revenue} Revenue
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Detail View */}
            <div className="flex-1 overflow-y-auto pl-2">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-gray-900">{selectedItem.name}</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Layers className="w-4 h-4 text-gray-400" /> Unit Price: ₹{selectedItem.unitEconomics.price}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Net Profit / Unit</div>
                        <div className="text-3xl font-bold text-green-700">₹{selectedItem.unitEconomics.profit}</div>
                    </div>
                </div>

                {/* Cost Structure Visualization */}
                <div className="mb-8">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-gray-700" /> Cost Structure Breakdown
                    </h4>
                    <div className="bg-gray-50 rounded-xl p-6">
                        {/* Stacked Bar */}
                        <div className="flex w-full h-8 rounded-full overflow-hidden mb-4">
                            {selectedItem.costStructure.map((cost, idx) => (
                                <div key={idx} className={`${cost.color} flex items-center justify-center text-xs font-bold text-white/90`} style={{ width: `${cost.value}%` }}>
                                    {cost.value > 10 && `${cost.value}%`}
                                </div>
                            ))}
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 justify-center">
                            {selectedItem.costStructure.map((cost, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${cost.color}`} />
                                    <span className="text-sm text-gray-600">{cost.type}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Dynamic Analysis */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-gray-700" /> Automated Analysis
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {selectedItem.margin < 10
                            ? "PROFIT WARNING: Material costs (55%) are eating into margins. This product is currently performing below the 15% sustainability threshold. Suggest auditing supplier contracts for raw materials."
                            : "HEALTHY MARGIN: This SKU is a top performer with a balanced cost structure. Production efficiency is high, contributing to the healthy 42% net margin."}
                    </p>
                </div>

            </div>
        </div>
    );
}
