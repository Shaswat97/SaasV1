"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/Card";

export type TabItem = {
    id: string;
    label: string;
    count?: number;
    content: React.ReactNode;
};

type DashboardTabsProps = {
    title: string;
    description?: string;
    tabs: TabItem[];
    className?: string;
};

export function DashboardTabs({ title, description, tabs, className }: DashboardTabsProps) {
    const [activeTab, setActiveTab] = useState(tabs[0].id);

    const activeContent = tabs.find((t) => t.id === activeTab)?.content;

    return (
        <Card className={cn("border-none shadow-sm bg-white rounded-3xl overflow-hidden", className)}>
            <div className="p-6 pb-0">
                <h3 className="text-lg font-serif font-bold text-gray-900 mb-1">{title}</h3>
                {description && <p className="text-sm text-gray-500 mb-6">{description}</p>}

                <div className="flex items-center gap-6 border-b border-gray-100 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "pb-3 text-sm font-medium transition-all relative whitespace-nowrap",
                                activeTab === tab.id
                                    ? "text-purple-600 font-semibold"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={cn(
                                    "ml-2 text-xs px-2 py-0.5 rounded-full",
                                    activeTab === tab.id ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
                                )}>
                                    {tab.count}
                                </span>
                            )}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600 rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-0">
                {activeContent}
            </div>
        </Card>
    );
}
