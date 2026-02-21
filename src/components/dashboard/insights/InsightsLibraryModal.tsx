"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import {
    TrendingDown,
    Activity,
    DollarSign,
    ArrowRight,
    ChevronLeft
} from "lucide-react";
import { InsightLossAnalysis } from "./InsightLossAnalysis";
import { InsightCapacityRisk } from "./InsightCapacityRisk";
import { InsightProfitability } from "./InsightProfitability";
import { InsightEmployeePerformance } from "./InsightEmployeePerformance";
import { InsightMachineHealth } from "./InsightMachineHealth";
import { InsightInventoryHealth } from "./InsightInventoryHealth";
import { Users } from "lucide-react";
import { Package } from "lucide-react";

type InsightTopic = "loss" | "capacity" | "profitability" | "workforce" | "machine_health" | "inventory" | null;

type InsightsLibraryModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function InsightsLibraryModal({ isOpen, onClose }: InsightsLibraryModalProps) {
    const [selectedTopic, setSelectedTopic] = useState<InsightTopic>(null);

    const topics = [
        {
            id: "loss" as const,
            title: "Loss & Leakage",
            description: "Analyze production waste, scrap costs, and material variance to identify top loss drivers.",
            icon: TrendingDown,
            color: "bg-red-100 text-red-600",
            tag: "#QualityControl",
            content: <InsightLossAnalysis />
        },
        {
            id: "capacity" as const,
            title: "Capacity Risk (7d)",
            description: "Forecast machine load vs required hours for the next week to prevent bottlenecks.",
            icon: Activity,
            color: "bg-blue-100 text-blue-600",
            tag: "#Machinery",
            content: <InsightCapacityRisk />
        },
        {
            id: "profitability" as const,
            title: "SKU Profitability",
            description: "Identify your most and least profitable products based on current production costs.",
            icon: DollarSign,
            color: "bg-green-100 text-green-600",
            tag: "#Strategy",
            content: <InsightProfitability />
        },
        {
            id: "workforce" as const,
            title: "Workforce Efficiency",
            description: "Track employee performance, output vs. expected targets, and efficiency trends.",
            icon: Users,
            color: "bg-purple-100 text-purple-600",
            tag: "#Workforce",
            content: <InsightEmployeePerformance />
        },
        {
            id: "machine_health" as const,
            title: "Machine Health (OEE)",
            description: "Monitor manufacturing equipment status, OEE scores, and downtime causes.",
            icon: Activity,
            color: "bg-blue-100 text-blue-600",
            tag: "#Machinery",
            content: <InsightMachineHealth />
        },
        {
            id: "inventory" as const,
            title: "Inventory Health",
            description: "Identify dead stock, slow-moving items, and stockout risks to optimize working capital.",
            icon: Package,
            color: "bg-orange-100 text-orange-600",
            tag: "#SupplyChain",
            content: <InsightInventoryHealth />
        }
    ];

    const activeTopic = topics.find(t => t.id === selectedTopic);

    return (
        <Modal
            open={isOpen}
            onClose={() => { onClose(); setSelectedTopic(null); }}
            title={selectedTopic ? (activeTopic?.title ?? "") : "AI Business Insights"}
            className={selectedTopic ? "max-w-[90vw] h-[85vh]" : "max-w-3xl"}
        >
            <div className={selectedTopic ? "h-full flex flex-col" : "min-h-[400px]"}>
                {!selectedTopic ? (
                    /* Library View */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {topics.map((topic) => (
                            <button
                                key={topic.id}
                                onClick={() => setSelectedTopic(topic.id)}
                                className="flex flex-col text-left p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-purple-200 transition-all group"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${topic.color}`}>
                                    <topic.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
                                    {topic.title}
                                </h3>
                                <p className="text-sm text-gray-500 mb-6 line-clamp-2">
                                    {topic.description}
                                </p>
                                <div className="mt-auto flex items-center justify-between w-full">
                                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
                                        {topic.tag}
                                    </span>
                                    <div className="flex items-center text-sm font-semibold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                        View <ArrowRight className="w-4 h-4 ml-1" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    /* Detail View */
                    <div className="flex-1 h-full animate-in fade-in slide-in-from-right-8 duration-300 flex flex-col">
                        <button
                            onClick={() => setSelectedTopic(null)}
                            className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors shrink-0"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Library
                        </button>
                        <div className="flex-1 overflow-hidden">
                            {activeTopic?.content}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
