"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { DataTable } from "@/components/DataTable";
import { apiGet } from "@/lib/api-client";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SnapshotCard } from "@/components/dashboard/SnapshotCard";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { RecentAlerts } from "@/components/dashboard/RecentAlerts";
import { InsightsLibraryModal } from "@/components/dashboard/insights/InsightsLibraryModal";
import {
  CreditCard,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  Download,
  Plus,
  Sparkles
} from "lucide-react";

// Formatting
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

type DashboardData = {
  cards: {
    orderBacklogValue: number;
    totalRevenue: number;
    deliveryCompletionPct: number;
    inventoryValue: number;
    avgOee: number;
    receivablesOutstanding: number;
    payablesOutstanding: number;
  };
  collections: {
    totalOutstanding: number;
    overdueOutstanding: number;
    dueIn7Days: number;
    collectedInRange: number;
  };
  payables: {
    totalOutstanding: number;
    overdueOutstanding: number;
    dueIn7Days: number;
    paidInRange: number;
  };
  productionOutput: {
    goodQty: number;
    rejectQty: number;
    scrapQty: number;
    yieldPct: number;
  };
  revenueSplit: {
    finishedRevenue: number;
    scrapRevenue: number;
    scrapSharePct: number;
    totalMargin: number;
  };
  topSkus: Array<{ code: string; quantity: number }>;
  alerts: {
    delayedDeliveries: any[];
    lowStock: any[];
  };
};

type DrilldownMetric = string;
type DashboardDrilldown = {
  metric: DrilldownMetric;
  title: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" | "center" }>;
  rows: Array<Record<string, string | number>>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const base = new Date();
    base.setDate(base.getDate() - 30);
    return base.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const query = `?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
        const [dashboard] = await Promise.all([
          apiGet<any>(`/api/dashboard${query}`),
        ]);
        setData(dashboard);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fromDate, toDate]);

  const fmt = (v: number) => currency.format(v);

  const collectionsData = [
    { label: "Outstanding", value: data ? fmt(data.collections.totalOutstanding) : "..." },
    { label: "Overdue", value: data ? fmt(data.collections.overdueOutstanding) : "...", color: "red" as const, highlight: true },
    { label: "Due in 7 days", value: data ? fmt(data.collections.dueIn7Days) : "..." },
    { label: "Collected in range", value: data ? fmt(data.collections.collectedInRange) : "...", color: "green" as const },
  ];

  const payablesData = [
    { label: "Outstanding", value: data ? fmt(data.payables.totalOutstanding) : "..." },
    { label: "Overdue", value: data ? fmt(data.payables.overdueOutstanding) : "...", color: "red" as const, highlight: true },
    { label: "Due in 7 days", value: data ? fmt(data.payables.dueIn7Days) : "..." },
    { label: "Paid in range", value: data ? fmt(data.payables.paidInRange) : "...", color: "green" as const },
  ];

  const productionSplitData = [
    { label: "Good", value: data ? number.format(data.productionOutput.goodQty) : "..." },
    { label: "Reject", value: data ? number.format(data.productionOutput.rejectQty) : "..." },
    { label: "Scrap", value: data ? number.format(data.productionOutput.scrapQty) : "..." },
    { label: "Yield %", value: data ? `${number.format(data.productionOutput.yieldPct)}%` : "..." },
  ];

  const revenueSplitData = [
    { label: "Finished Goods", value: data ? fmt(data.revenueSplit.finishedRevenue) : "..." },
    { label: "Scrap", value: data ? fmt(data.revenueSplit.scrapRevenue) : "..." },
    { label: "Scrap Share", value: data ? `${number.format(data.revenueSplit.scrapSharePct)}%` : "..." },
    { label: "Total Margin", value: data ? fmt(data.revenueSplit.totalMargin) : "..." },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-auto border-none h-8 text-sm focus:ring-0 bg-transparent"
            />
            <span className="text-gray-400">-</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-auto border-none h-8 text-sm focus:ring-0 bg-transparent"
            />
          </div>

          <button
            onClick={() => setShowInsights(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Get Insights
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Row 1: Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Order Backlog"
          value={data ? currency.format(data.cards.orderBacklogValue) : "..."}
          trend={data ? `${number.format(data.cards.deliveryCompletionPct)}% delivered` : "..."}
          trendDirection="flat"
          subtext=""
          icon={Package}
          iconColor="text-purple-500"
        />
        <MetricCard
          label="Total Revenue"
          value={data ? currency.format(data.cards.totalRevenue) : "..."}
          trend="21 Jan - 19 Feb"
          trendDirection="flat"
          subtext=""
          icon={CreditCard}
          iconColor="text-blue-500"
        />
        <MetricCard
          label="Inventory Value"
          value={data ? currency.format(data.cards.inventoryValue) : "..."}
          trend="Across all zones"
          trendDirection="flat"
          subtext=""
          icon={ShoppingCart}
          iconColor="text-amber-500"
        />
        <MetricCard
          label="Receivables"
          value={data ? currency.format(data.cards.receivablesOutstanding) : "..."}
          trend="Outstanding"
          trendDirection="flat"
          subtext=""
          icon={TrendingUp}
          iconColor="text-green-500"
        />
      </div>

      {/* Row 2: Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Payables"
          value={data ? currency.format(data.cards.payablesOutstanding) : "..."}
          trend="Outstanding"
          trendDirection="flat"
          subtext=""
          icon={TrendingDown}
          iconColor="text-red-500"
        />
        <MetricCard
          label="Avg. OEE"
          value={data ? `${number.format(data.cards.avgOee)}%` : "..."}
          trend="Selected range"
          trendDirection="flat"
          subtext=""
          icon={CheckCircle}
          iconColor="text-emerald-500"
        />
        <MetricCard
          label="Delivery Completion"
          value={data ? `${number.format(data.cards.deliveryCompletionPct)}%` : "..."}
          trend="Open orders"
          trendDirection="flat"
          subtext=""
          icon={Clock}
          iconColor="text-gray-500"
        />
        {/* Spacer or Future Metric */}
        <div className="hidden lg:block"></div>
      </div>

      {/* Row 3: Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SnapshotCard title="Collections Snapshot" items={collectionsData} />
        <SnapshotCard title="Payables Snapshot" items={payablesData} />
        <SnapshotCard title="Production Output Split" items={productionSplitData} />
        <SnapshotCard title="Revenue Split" items={revenueSplitData} />
      </div>

      {/* Row 4: Tabbed Footer */}
      <div className="mt-4">
        <DashboardTabs
          title="Alerts & Production Log"
          description="Use tabs to switch between production backlog and alert resolution tables."
          tabs={[
            {
              id: "production",
              label: "Production Log",
              count: 0,
              content: (
                <div className="p-6">
                  <DataTable
                    columns={[
                      { key: "sku", label: "ITEM" },
                      { key: "qty", label: "QTY", align: "right" },
                      { key: "status", label: "STATUS", align: "right" }
                    ]}
                    rows={[]}
                    emptyLabel="No production logs."
                    className="border-none shadow-none"
                  />
                </div>
              )
            },
            {
              id: "alerts",
              label: "Recent Alerts",
              count: data ? (data.alerts?.delayedDeliveries?.length || 0) : 0,
              content: (
                <div className="p-6">
                  {data && <RecentAlerts alerts={data.alerts} />}
                </div>
              )
            },
            { id: "stock", label: "Low Stock", count: data ? (data.alerts?.lowStock?.length || 0) : 0, content: <div className="p-6 text-sm text-gray-500">Low stock items...</div> },
            { id: "downtime", label: "Machine Downtime", count: 0, content: <div className="p-6 text-sm text-gray-500">No downtime recorded.</div> },
          ]}
        />
      </div>

      {/* Business Insights Modal */}
      <InsightsLibraryModal isOpen={showInsights} onClose={() => setShowInsights(false)} />

    </div>
  );
}
