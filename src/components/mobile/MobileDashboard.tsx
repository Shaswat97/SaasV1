"use client";

import { useState } from "react";
import { Bell, Search, User, Briefcase, Activity, AlertTriangle, Package, TrendingUp } from "lucide-react";
import { BalanceCard } from "@/components/mobile/BalanceCard";
import { QuickStatPill } from "@/components/mobile/QuickStatPill";
import { MobileTransactionItem } from "@/components/mobile/MobileTransactionItem";
import { DonutChart } from "@/components/dashboard/DonutChart";

// Data Types
type MobileDashboardProps = {
    user: { name: string; avatar?: string };
    metrics: {
        totalRevenue: string;
        revenueTrend: string;
        revenueHistory: { label: string; value: number }[];
        backlogValue: string;
        avgOee: string;
    };
    orderStatusData: Array<{ name: string; value: number; color: string }>;
    alerts: {
        delayed: number;
        lowStock: number;
        production: number;
    };
    lists: {
        topSkus: Array<{ sku: string; qty: string }>;
        machineUtil: Array<{ machine: string; util: string }>;
    };
    recentActivity: Array<{
        id: string;
        title: string;
        subtitle: string;
        amount: string;
        status: "completed" | "pending" | "warning";
        date: string;
    }>;
};

export function MobileDashboard({ user, metrics, orderStatusData, alerts, lists, recentActivity }: MobileDashboardProps) {
    const [activeTab, setActiveTab] = useState<"activity" | "skus" | "machines">("activity");

    return (
        <div className="min-h-screen bg-gray-50 pb-24 md:hidden font-sans overflow-x-hidden w-full max-w-[100vw]">
            {/* 1. Header */}
            <div className="flex items-center justify-between px-6 pt-12 pb-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                        <User className="h-6 w-6 text-gray-500" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Welcome back,</p>
                        <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button className="rounded-full bg-white p-2 shadow-sm border border-gray-100"><Search className="h-5 w-5 text-gray-600" /></button>
                    <button className="rounded-full bg-white p-2 shadow-sm border border-gray-100 relative">
                        <Bell className="h-5 w-5 text-gray-600" />
                        {alerts.delayed > 0 && <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white"></span>}
                    </button>
                </div>
            </div>

            {/* 2. Balance Card (Hero) */}
            <div className="px-6 mb-8">
                <BalanceCard
                    label="Total Revenue"
                    amount={metrics.totalRevenue}
                    trend={metrics.revenueTrend}
                    data={metrics.revenueHistory}
                />
            </div>

            {/* 3. Quick Stats Row (Scrollable) */}
            <div className="px-6 mb-8">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Overview</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                    <div className="min-w-[160px]">
                        <QuickStatPill
                            label="Backlog"
                            value={metrics.backlogValue}
                            icon={Briefcase}
                            color="orange"
                            subtext="Open Orders"
                        />
                    </div>
                    <div className="min-w-[160px]">
                        <QuickStatPill
                            label="Avg OEE"
                            value={metrics.avgOee}
                            icon={Activity}
                            color="blue"
                            subtext="Efficiency"
                        />
                    </div>
                    <div className="min-w-[160px]">
                        <QuickStatPill
                            label="Delayed"
                            value={alerts.delayed.toString()}
                            icon={AlertTriangle}
                            color="orange"
                            subtext="Action Req."
                        />
                    </div>
                </div>
            </div>

            {/* 4. Charts Section (Order Status) */}
            <div className="px-6 mb-8">
                <div className="rounded-[2rem] bg-white p-6 shadow-sm shadow-blue-900/5">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Order Status</h3>
                    <div className="flex items-center justify-center">
                        <DonutChart
                            data={orderStatusData}
                            height={200}
                            centerLabel={orderStatusData.reduce((acc, curr) => acc + curr.value, 0).toString()}
                            centerSubLabel="Total"
                        />
                    </div>
                    <div className="mt-6 flex justify-center gap-4 flex-wrap">
                        {orderStatusData.map((item) => (
                            <div key={item.name} className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs font-medium text-gray-600">{item.name} ({item.value})</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 5. Data Lists (Tabs) */}
            <div className="px-6 rounded-t-[2rem] bg-white pt-8 -mt-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] pb-8">
                {/* Custom Tabs */}
                <div className="flex gap-6 border-b border-gray-100 pb-4 mb-6 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab("activity")}
                        className={`text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "activity" ? "text-primary" : "text-gray-400"}`}
                    >
                        Recent Activity
                    </button>
                    <button
                        onClick={() => setActiveTab("skus")}
                        className={`text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "skus" ? "text-primary" : "text-gray-400"}`}
                    >
                        Top SKUs
                    </button>
                    <button
                        onClick={() => setActiveTab("machines")}
                        className={`text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "machines" ? "text-primary" : "text-gray-400"}`}
                    >
                        Machine Util
                    </button>
                </div>

                {/* Tab Content */}
                <div className="space-y-1 min-h-[200px]">
                    {activeTab === "activity" && recentActivity.map((item) => (
                        <MobileTransactionItem key={item.id} {...item} />
                    ))}

                    {activeTab === "skus" && lists.topSkus.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                                    <Package className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{item.sku}</h4>
                                </div>
                            </div>
                            <span className="font-bold text-gray-900">{item.qty}</span>
                        </div>
                    ))}

                    {activeTab === "machines" && lists.machineUtil.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm text-gray-900">{item.machine}</h4>
                                </div>
                            </div>
                            <span className="font-bold text-gray-900">{item.util}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
