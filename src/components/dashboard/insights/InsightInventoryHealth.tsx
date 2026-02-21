"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Package, AlertTriangle, Clock, TrendingDown, AlertCircle } from "lucide-react";
import { DataTable } from "@/components/DataTable";

type InventoryCategory = {
    id: string;
    title: string;
    description: string;
    severity: "critical" | "warning" | "neutral";
    count: number;
    icon: any;
};

const categories: InventoryCategory[] = [
    {
        id: "stockout_risk",
        title: "Stockout Risk",
        description: "Raw materials with less than 14 days of cover.",
        severity: "critical",
        count: 1,
        icon: AlertTriangle
    },
    {
        id: "dead_stock",
        title: "Dead Stock",
        description: "No movement for 90+ days.",
        severity: "neutral",
        count: 0,
        icon: Package
    },
    {
        id: "slow_moving",
        title: "Slow Moving",
        description: "Movement older than 30 days.",
        severity: "warning",
        count: 1,
        icon: Clock
    },
    {
        id: "batch_aging",
        title: "Raw Batch Aging",
        description: "Open raw batches older than 30 days.",
        severity: "neutral",
        count: 0,
        icon: Clock
    }
];

// Mock Data for Details
const stockoutData = [
    { sku: "RM-01 - Steel Rod 12mm", onHand: "0 KG", dailyUse: "400 KG", cover: "0 Days" }
];

const slowMovingData = [
    { sku: "RM-001 - Steel Sheet 2mm", qty: "5,197 kg", age: "45 Days" }
];

export function InsightInventoryHealth() {
    const [selectedId, setSelectedId] = useState<string>("stockout_risk");
    const selectedCategory = categories.find(c => c.id === selectedId) || categories[0];

    const renderDetailContent = () => {
        switch (selectedId) {
            case "stockout_risk":
                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 mb-6">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span className="text-sm font-medium">Immediate Action Required: Production layout at risk for 1 item.</span>
                        </div>
                        <DataTable
                            columns={[
                                { key: "sku", label: "RAW SKU" },
                                { key: "onHand", label: "ON HAND", align: "right" },
                                { key: "dailyUse", label: "AVG DAILY USE", align: "right" },
                                { key: "cover", label: "DAYS COVER", align: "right" },
                            ]}
                            rows={stockoutData}
                            className="bg-white"
                            emptyLabel="No stockout risks detected."
                        />
                        <div className="flex justify-end mt-4">
                            <button className="text-sm text-red-600 font-bold hover:underline">Generate Reorder Request →</button>
                        </div>
                    </div>
                );
            case "dead_stock":
                return (
                    <div className="space-y-4">
                        <DataTable
                            columns={[
                                { key: "sku", label: "SKU" },
                                { key: "qty", label: "QTY", align: "right" },
                                { key: "age", label: "AGE (DAYS)", align: "right" },
                            ]}
                            rows={[]} // Empty for demo as per screenshot
                            className="bg-white"
                            emptyLabel="No dead stock detected. Great job!"
                        />
                    </div>
                );
            case "slow_moving":
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500 mb-4">Items with low turnover rate over the last 30 days.</p>
                        <DataTable
                            columns={[
                                { key: "sku", label: "SKU" },
                                { key: "qty", label: "QTY", align: "right" },
                                { key: "age", label: "AGE (DAYS)", align: "right" },
                            ]}
                            rows={slowMovingData}
                            className="bg-white"
                            emptyLabel="No slow moving items."
                        />
                    </div>
                );
            case "batch_aging":
                return (
                    <div className="space-y-4">
                        <DataTable
                            columns={[
                                { key: "batch", label: "BATCH" },
                                { key: "sku", label: "SKU" },
                                { key: "remaining", label: "REMAINING", align: "right" },
                                { key: "age", label: "AGE (DAYS)", align: "right" },
                            ]}
                            rows={[]} // Empty per screenshot
                            className="bg-white"
                            emptyLabel="No aged raw batches."
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex h-full gap-6">
            {/* Master List */}
            <div className="w-1/3 border-r border-gray-100 pr-6 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Health Categories</h3>
                <div className="space-y-3">
                    {categories.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${selectedId === item.id
                                    ? "bg-gray-50 border-gray-300 shadow-sm"
                                    : "bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold text-sm ${selectedId === item.id ? "text-gray-900" : "text-gray-600"}`}>
                                    {item.title}
                                </span>
                                <Badge
                                    variant={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "neutral"}
                                    label={item.count > 0 ? `${item.count} Items` : "Clean"}
                                    className="text-[10px]"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{item.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Detail View */}
            <div className="flex-1 overflow-y-auto pl-2">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-gray-900">{selectedCategory.title}</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <selectedCategory.icon className="w-4 h-4 text-gray-400" />
                                {selectedCategory.description}
                            </span>
                        </div>
                    </div>
                </div>

                {renderDetailContent()}

            </div>
        </div>
    );
}
