"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { SectionHeader } from "@/components/SectionHeader";
import { StatsCard } from "@/components/StatsCard";
import { Tabs } from "@/components/Tabs";
import { apiGet } from "@/lib/api-client";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });

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
  productionOutput: {
    goodQty: number;
    rejectQty: number;
    scrapQty: number;
    totalQty: number;
    yieldPct: number;
    rejectPct: number;
    scrapPct: number;
  };
  revenueSplit: {
    finishedRevenue: number;
    scrapRevenue: number;
    totalRevenue: number;
    scrapSharePct: number;
    finishedMargin: number;
    scrapMargin: number;
    totalMargin: number;
  };
  lossLeakage: {
    rejectCost: number;
    scrapCost: number;
    materialVarianceCost: number;
    topLossSkus: Array<{
      skuId: string;
      code: string;
      name: string;
      rejectQty: number;
      scrapQty: number;
      lossQty: number;
      lossCost: number;
      logs: number;
      fixPath: string;
    }>;
    topLossMachines: Array<{
      machineId: string;
      code: string;
      name: string;
      rejectQty: number;
      scrapQty: number;
      lossQty: number;
      lossCost: number;
      logs: number;
      fixPath: string;
    }>;
  };
  topSkus: Array<{
    skuId: string;
    code: string;
    name: string;
    quantity: number;
    revenue: number;
    margin: number;
    marginPct: number;
  }>;
  machineUtilization: Array<{
    machineId: string;
    code: string;
    name: string;
    runtimeMinutes: number;
    utilizationPct: number;
    avgOee: number;
    yieldPct: number;
    runs: number;
    fixPath: string;
  }>;
  machineEffectiveness: Array<{
    machineId: string;
    code: string;
    name: string;
    runtimeMinutes: number;
    goodQty: number;
    rejectQty: number;
    scrapQty: number;
    oeeTotal: number;
    runs: number;
    utilizationPct: number;
    avgOee: number;
    yieldPct: number;
    fixPath: string;
    downtimeMinutes: number;
    lossQty: number;
    throughputPerHour: number;
  }>;
  capacityRisk: {
    windowDays: number;
    items: Array<{
      machineId: string;
      code: string;
      name: string;
      requiredMinutes: number;
      availableMinutes: number;
      loadPct: number;
      risk: "LOW" | "WATCH" | "HIGH" | "CRITICAL";
    }>;
    missingRouting: Array<{
      skuId: string;
      code: string;
      name: string;
      openQty: number;
      unit: string;
      fixPath: string;
    }>;
  };
  skuProfitability: {
    top: Array<{
      skuId: string;
      code: string;
      name: string;
      quantity: number;
      revenue: number;
      cost: number;
      margin: number;
      marginPct: number;
    }>;
    bottom: Array<{
      skuId: string;
      code: string;
      name: string;
      quantity: number;
      revenue: number;
      cost: number;
      margin: number;
      marginPct: number;
    }>;
  };
  productionYield: {
    goodQty: number;
    rejectQty: number;
    scrapQty: number;
    yieldPct: number;
    bySku: Array<{
      skuId: string;
      code: string;
      name: string;
      good: number;
      reject: number;
      scrap: number;
      yieldPct: number;
    }>;
  };
  collections: {
    totalOutstanding: number;
    overdueOutstanding: number;
    dueIn7Days: number;
    collectedInRange: number;
    aging: Array<{ bucket: string; amount: number }>;
  };
  payables: {
    totalOutstanding: number;
    overdueOutstanding: number;
    dueIn7Days: number;
    paidInRange: number;
    aging: Array<{ bucket: string; amount: number }>;
  };
  inventoryHealth: {
    deadStock: Array<{
      skuId: string;
      code: string;
      name: string;
      unit: string;
      qty: number;
      ageDays: number;
      fixPath: string;
    }>;
    slowMoving: Array<{
      skuId: string;
      code: string;
      name: string;
      unit: string;
      qty: number;
      ageDays: number;
      fixPath: string;
    }>;
    stockoutRisk: Array<{
      skuId: string;
      code: string;
      name: string;
      unit: string;
      onHand: number;
      avgDailyUsage: number;
      daysCover: number | null;
      fixPath: string;
    }>;
    rawBatchAging: Array<{
      batchId: string;
      batchNumber: string;
      skuId: string;
      skuCode: string;
      skuName: string;
      unit: string;
      quantityRemaining: number;
      ageDays: number;
      fixPath: string;
    }>;
  };
  alerts: {
    lowStock: Array<{
      skuId: string;
      code: string;
      name: string;
      unit: string;
      skuType: string;
      onHand: number;
      threshold: number;
      shortage: number;
      fixPath: string;
    }>;
    delayedDeliveries: Array<{
      soNumber: string;
      customer: string;
      sku: string;
      openQty: number;
      unit: string;
      daysOpen: number;
      fixPath: string;
    }>;
    machineDowntime: Array<{ id: string; code: string; name: string; lastRunAt: string | null; fixPath: string }>;
    highReject: Array<{
      logId: string;
      machine: string;
      sku: string;
      rejectPct: number;
      fixPath: string;
    }>;
    scrapSpike: Array<{
      skuId: string;
      code: string;
      name: string;
      currentRate: number;
      previousRate: number;
      delta: number;
      fixPath: string;
    }>;
    overdueReceivables: Array<{
      invoiceNumber: string;
      customer: string;
      soNumber: string;
      dueDate: string | null;
      balanceAmount: number;
      fixPath: string;
    }>;
    overduePayables: Array<{
      billNumber: string;
      vendor: string;
      dueDate: string | null;
      balanceAmount: number;
      fixPath: string;
    }>;
  };
  employeePerformance: {
    date: string;
    topEmployees: Array<{
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      minutes: number;
      expectedUnits: number;
      actualUnits: number;
      performancePct: number;
      rating: number;
    }>;
  };
  employeeEfficiency: {
    teamAveragePerformancePct: number;
    top: Array<{
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      minutes: number;
      expectedUnits: number;
      actualUnits: number;
      performancePct: number;
      expectedRawCost: number;
      actualRawCost: number;
      materialVariancePct: number;
      rating: number;
      varianceFromTeamPct: number;
    }>;
    bottom: Array<{
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      minutes: number;
      expectedUnits: number;
      actualUnits: number;
      performancePct: number;
      expectedRawCost: number;
      actualRawCost: number;
      materialVariancePct: number;
      rating: number;
      varianceFromTeamPct: number;
    }>;
  };
};

type BacklogLine = {
  id: string;
  soNumber: string;
  status: string;
  customer: string;
  skuCode: string;
  skuName: string;
  unit: string;
  orderedQty: number;
  producedQty: number;
  openQty: number;
};

type DrilldownMetric =
  | "orderBacklog"
  | "totalRevenue"
  | "inventoryValue"
  | "receivables"
  | "payables"
  | "avgOee"
  | "deliveryCompletion";

type DashboardDrilldown = {
  metric: DrilldownMetric;
  title: string;
  description: string;
  modulePath: string;
  sourceCount: number;
  columns: Array<{ key: string; label: string; align?: "left" | "right" | "center" }>;
  rows: Array<Record<string, string | number>>;
};

function riskBadge(risk: "LOW" | "WATCH" | "HIGH" | "CRITICAL") {
  if (risk === "CRITICAL") return { label: "Critical", variant: "danger" as const };
  if (risk === "HIGH") return { label: "High", variant: "warning" as const };
  if (risk === "WATCH") return { label: "Watch", variant: "info" as const };
  return { label: "Low", variant: "success" as const };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [backlog, setBacklog] = useState<BacklogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const base = new Date();
    base.setDate(base.getDate() - 29);
    return base.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DashboardDrilldown | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const query = `?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
        const [dashboard, backlogData] = await Promise.all([
          apiGet<DashboardData>(`/api/dashboard${query}`),
          apiGet<BacklogLine[]>(`/api/production-logs/backlog${query}`)
        ]);
        setData(dashboard);
        setBacklog(backlogData);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [fromDate, toDate]);

  const cards = useMemo(() => {
    if (!data) return [];
    const rangeLabel = `${shortDate.format(new Date(fromDate))} - ${shortDate.format(new Date(toDate))}`;
    return [
      {
        metric: "orderBacklog" as const,
        label: "Order Backlog",
        value: currency.format(data.cards.orderBacklogValue),
        delta: `${number.format(data.cards.deliveryCompletionPct)}% delivered`,
        trend: "flat" as const,
        deltaMode: "badge" as const
      },
      {
        metric: "totalRevenue" as const,
        label: "Total Revenue",
        value: currency.format(data.cards.totalRevenue),
        delta: rangeLabel,
        trend: "up" as const,
        deltaMode: "text" as const
      },
      {
        metric: "inventoryValue" as const,
        label: "Inventory Value",
        value: currency.format(data.cards.inventoryValue),
        delta: "Across all zones",
        trend: "flat" as const,
        deltaMode: "text" as const
      },
      {
        metric: "receivables" as const,
        label: "Receivables",
        value: currency.format(data.cards.receivablesOutstanding),
        delta: "Outstanding",
        trend: "flat" as const,
        deltaMode: "text" as const
      },
      {
        metric: "payables" as const,
        label: "Payables",
        value: currency.format(data.cards.payablesOutstanding),
        delta: "Outstanding",
        trend: "flat" as const,
        deltaMode: "text" as const
      },
      {
        metric: "avgOee" as const,
        label: "Avg. OEE",
        value: `${number.format(data.cards.avgOee)}%`,
        delta: "Selected range",
        trend: "up" as const,
        deltaMode: "badge" as const
      },
      {
        metric: "deliveryCompletion" as const,
        label: "Delivery Completion",
        value: `${number.format(data.cards.deliveryCompletionPct)}%`,
        delta: "Open orders",
        trend: "flat" as const,
        deltaMode: "badge" as const
      }
    ];
  }, [data, fromDate, toDate]);

  const openDrilldown = async (metric: DrilldownMetric) => {
    setDrilldownOpen(true);
    setDrilldownLoading(true);
    setDrilldownError(null);
    try {
      const query = `metric=${encodeURIComponent(metric)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
      const payload = await apiGet<DashboardDrilldown>(`/api/dashboard/drilldown?${query}`);
      setDrilldown(payload);
    } catch (error) {
      setDrilldown(null);
      setDrilldownError(error instanceof Error ? error.message : "Failed to load breakdown.");
    } finally {
      setDrilldownLoading(false);
    }
  };

  const drilldownRows = useMemo(() => {
    if (!drilldown) return [];
    const currencyKeys = new Set(["total", "balance", "openValue", "value", "cp", "outstanding"]);
    const pctKeys = new Set(["oee", "completion"]);
    return drilldown.rows.map((row) => {
      const formatted: Record<string, string | number> = {};
      Object.entries(row).forEach(([key, value]) => {
        if (typeof value !== "number") {
          formatted[key] = value;
          return;
        }
        if (currencyKeys.has(key)) {
          formatted[key] = currency.format(value);
          return;
        }
        if (pctKeys.has(key)) {
          formatted[key] = `${number.format(value)}%`;
          return;
        }
        formatted[key] = number.format(value);
      });
      return formatted;
    });
  }, [drilldown]);

  const alertTabs = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: `Production Log (${backlog.length})`,
        value: "production-log",
        content: (
          <DataTable
            columns={[
              { key: "order", label: "Order" },
              { key: "customer", label: "Customer" },
              { key: "sku", label: "SKU" },
              { key: "open", label: "Open Qty", align: "right" },
              { key: "openLink", label: "" }
            ]}
            rows={backlog.slice(0, 12).map((line) => ({
              order: line.soNumber,
              customer: line.customer,
              sku: `${line.skuCode} · ${line.skuName}`,
              open: `${line.openQty} ${line.unit}`,
              openLink: (
                <Link className="text-xs underline" href="/production">
                  Open
                </Link>
              )
            }))}
            emptyLabel={loading ? "Loading production log..." : "No production backlog."}
          />
        )
      },
      {
        label: `Low Stock (${data.alerts.lowStock.length})`,
        value: "low",
        content: (
          <DataTable
            columns={[
              { key: "sku", label: "SKU" },
              { key: "type", label: "Type" },
              { key: "onhand", label: "On Hand", align: "right" },
              { key: "threshold", label: "Threshold", align: "right" },
              { key: "shortage", label: "Shortage", align: "right" },
              { key: "fix", label: "" }
            ]}
            rows={data.alerts.lowStock.map((item) => ({
              sku: `${item.code} · ${item.name}`,
              type: item.skuType === "RAW" ? "Raw" : "Finished",
              onhand: `${item.onHand} ${item.unit}`,
              threshold: `${item.threshold} ${item.unit}`,
              shortage: `${item.shortage} ${item.unit}`,
              fix: (
                <Link className="text-xs underline" href={item.fixPath}>
                  Fix
                </Link>
              )
            }))}
            emptyLabel="No low stock alerts."
          />
        )
      },
      {
        label: `Delayed Deliveries (${data.alerts.delayedDeliveries.length})`,
        value: "delayed",
        content: (
          <DataTable
            columns={[
              { key: "order", label: "Order" },
              { key: "customer", label: "Customer" },
              { key: "open", label: "Open Qty", align: "right" },
              { key: "days", label: "Days", align: "right" },
              { key: "fix", label: "" }
            ]}
            rows={data.alerts.delayedDeliveries.map((item) => ({
              order: item.soNumber,
              customer: item.customer,
              open: `${item.openQty} ${item.unit}`,
              days: item.daysOpen,
              fix: (
                <Link className="text-xs underline" href={item.fixPath}>
                  Open
                </Link>
              )
            }))}
            emptyLabel="No delayed deliveries."
          />
        )
      },
      {
        label: `Machine Downtime (${data.alerts.machineDowntime.length})`,
        value: "downtime",
        content: (
          <DataTable
            columns={[
              { key: "machine", label: "Machine" },
              { key: "last", label: "Last Run" },
              { key: "fix", label: "" }
            ]}
            rows={data.alerts.machineDowntime.map((item) => ({
              machine: `${item.code} · ${item.name}`,
              last: item.lastRunAt ? new Date(item.lastRunAt).toLocaleDateString("en-IN") : "No runs",
              fix: (
                <Link className="text-xs underline" href={item.fixPath}>
                  Open
                </Link>
              )
            }))}
            emptyLabel="No downtime alerts."
          />
        )
      },
      {
        label: `High Reject (${data.alerts.highReject.length})`,
        value: "high-reject",
        content: (
          <DataTable
            columns={[
              { key: "machine", label: "Machine" },
              { key: "sku", label: "SKU" },
              { key: "rejectPct", label: "Reject %", align: "right" },
              { key: "fix", label: "" }
            ]}
            rows={data.alerts.highReject.map((item) => ({
              machine: item.machine,
              sku: item.sku,
              rejectPct: `${number.format(item.rejectPct)}%`,
              fix: (
                <Link className="text-xs underline" href={item.fixPath}>
                  Fix
                </Link>
              )
            }))}
            emptyLabel="No high reject alerts."
          />
        )
      },
      {
        label: `Scrap Spike (${data.alerts.scrapSpike.length})`,
        value: "scrap-spike",
        content: (
          <DataTable
            columns={[
              { key: "sku", label: "SKU" },
              { key: "current", label: "Current %", align: "right" },
              { key: "previous", label: "Previous %", align: "right" },
              { key: "delta", label: "Delta", align: "right" },
              { key: "fix", label: "" }
            ]}
            rows={data.alerts.scrapSpike.map((item) => ({
              sku: `${item.code} · ${item.name}`,
              current: `${number.format(item.currentRate)}%`,
              previous: `${number.format(item.previousRate)}%`,
              delta: `+${number.format(item.delta)}%`,
              fix: (
                <Link className="text-xs underline" href={item.fixPath}>
                  Fix
                </Link>
              )
            }))}
            emptyLabel="No scrap spike alerts."
          />
        )
      },
      {
        label: `Overdue Receivables (${data.alerts.overdueReceivables.length})`,
        value: "receivables",
        content: (
          <DataTable
            columns={[
              { key: "invoice", label: "Invoice" },
              { key: "customer", label: "Customer" },
              { key: "due", label: "Due" },
              { key: "amount", label: "Balance", align: "right" },
              { key: "fix", label: "" }
            ]}
            rows={data.alerts.overdueReceivables.map((item) => ({
              invoice: item.invoiceNumber,
              customer: item.customer,
              due: item.dueDate ? new Date(item.dueDate).toLocaleDateString("en-IN") : "—",
              amount: currency.format(item.balanceAmount),
              fix: (
                <Link className="text-xs underline" href={item.fixPath}>
                  Collect
                </Link>
              )
            }))}
            emptyLabel="No overdue receivables."
          />
        )
      },
      {
        label: `Overdue Payables (${data.alerts.overduePayables.length})`,
        value: "payables",
        content: (
          <DataTable
            columns={[
              { key: "bill", label: "Bill" },
              { key: "vendor", label: "Vendor" },
              { key: "due", label: "Due" },
              { key: "amount", label: "Balance", align: "right" },
              { key: "fix", label: "" }
            ]}
            rows={data.alerts.overduePayables.map((item) => ({
              bill: item.billNumber,
              vendor: item.vendor,
              due: item.dueDate ? new Date(item.dueDate).toLocaleDateString("en-IN") : "—",
              amount: currency.format(item.balanceAmount),
              fix: (
                <Link className="text-xs underline" href={item.fixPath}>
                  Pay
                </Link>
              )
            }))}
            emptyLabel="No overdue payables."
          />
        )
      }
    ];
  }, [backlog, data, loading]);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Command Center"
        subtitle="Live snapshot of demand, inventory exposure, and production health."
        actions={
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => openDrilldown(card.metric)}
            className="block text-left transition hover:-translate-y-0.5"
          >
            <StatsCard
              label={card.label}
              value={card.value}
              delta={card.delta}
              trend={card.trend}
              deltaMode={card.deltaMode}
            />
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Collections Snapshot</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Outstanding</span>
                <span className="font-medium">{currency.format(data?.collections.totalOutstanding ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Overdue</span>
                <span className="font-medium text-danger">{currency.format(data?.collections.overdueOutstanding ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Due in 7 days</span>
                <span className="font-medium">{currency.format(data?.collections.dueIn7Days ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Collected in range</span>
                <span className="font-medium text-success">{currency.format(data?.collections.collectedInRange ?? 0)}</span>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payables Snapshot</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Outstanding</span>
                <span className="font-medium">{currency.format(data?.payables.totalOutstanding ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Overdue</span>
                <span className="font-medium text-danger">{currency.format(data?.payables.overdueOutstanding ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Due in 7 days</span>
                <span className="font-medium">{currency.format(data?.payables.dueIn7Days ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Paid in range</span>
                <span className="font-medium text-success">{currency.format(data?.payables.paidInRange ?? 0)}</span>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Production Output Split</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Good</span>
                <span className="font-medium">{number.format(data?.productionOutput.goodQty ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Reject</span>
                <span className="font-medium">{number.format(data?.productionOutput.rejectQty ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Scrap</span>
                <span className="font-medium">{number.format(data?.productionOutput.scrapQty ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Yield %</span>
                <span className="font-medium">{number.format(data?.productionOutput.yieldPct ?? 0)}%</span>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue Split</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Finished Goods</span>
                <span className="font-medium">{currency.format(data?.revenueSplit.finishedRevenue ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Scrap</span>
                <span className="font-medium">{currency.format(data?.revenueSplit.scrapRevenue ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Scrap Share</span>
                <span className="font-medium">{number.format(data?.revenueSplit.scrapSharePct ?? 0)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Total Margin</span>
                <span className="font-medium">{currency.format(data?.revenueSplit.totalMargin ?? 0)}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card variant="strong">
        <CardHeader>
          <CardTitle>Alerts & Production Log</CardTitle>
          <CardDescription>Use tabs to switch between production backlog and alert resolution tables.</CardDescription>
        </CardHeader>
        <CardBody>{alertTabs.length ? <Tabs items={alertTabs} /> : <p className="text-sm text-text-muted">Loading alerts...</p>}</CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Loss & Leakage</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Reject Cost</span>
                <span className="font-medium text-danger">{currency.format(data?.lossLeakage.rejectCost ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Scrap Cost</span>
                <span className="font-medium text-danger">{currency.format(data?.lossLeakage.scrapCost ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Material Variance</span>
                <span className="font-medium text-warning">{currency.format(data?.lossLeakage.materialVarianceCost ?? 0)}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-border/50 pt-3">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-text-muted">Top Loss SKUs</p>
              <DataTable
                columns={[
                  { key: "sku", label: "SKU" },
                  { key: "loss", label: "Loss Qty", align: "right" },
                  { key: "cost", label: "Loss Cost", align: "right" }
                ]}
                rows={(data?.lossLeakage.topLossSkus ?? []).map((row) => ({
                  sku: `${row.code} · ${row.name}`,
                  loss: number.format(row.lossQty),
                  cost: currency.format(row.lossCost)
                }))}
                emptyLabel="No loss SKU data."
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top Loss Machines</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "machine", label: "Machine" },
                { key: "loss", label: "Loss Qty", align: "right" },
                { key: "cost", label: "Loss Cost", align: "right" },
                { key: "fix", label: "" }
              ]}
              rows={(data?.lossLeakage.topLossMachines ?? []).map((row) => ({
                machine: `${row.code} · ${row.name}`,
                loss: number.format(row.lossQty),
                cost: currency.format(row.lossCost),
                fix: (
                  <Link className="text-xs underline" href={row.fixPath}>
                    Fix
                  </Link>
                )
              }))}
              emptyLabel="No machine loss data."
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top SKUs</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "qty", label: "Qty", align: "right" },
                { key: "revenue", label: "Revenue", align: "right" },
                { key: "margin", label: "Margin", align: "right" }
              ]}
              rows={(data?.topSkus ?? []).map((sku) => ({
                sku: `${sku.code} · ${sku.name}`,
                qty: number.format(sku.quantity),
                revenue: currency.format(sku.revenue),
                margin: `${currency.format(sku.margin)} (${number.format(sku.marginPct)}%)`
              }))}
              emptyLabel="No SKU performance data."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity Risk ({data?.capacityRisk.windowDays ?? 7}d)</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "machine", label: "Machine" },
                { key: "load", label: "Load %", align: "right" },
                { key: "required", label: "Required Hrs", align: "right" },
                { key: "risk", label: "Risk", align: "center" }
              ]}
              rows={(data?.capacityRisk.items ?? []).map((item) => ({
                machine: `${item.code} · ${item.name}`,
                load: `${number.format(item.loadPct)}%`,
                required: number.format(item.requiredMinutes / 60),
                risk: <Badge {...riskBadge(item.risk)} />
              }))}
              emptyLabel="No capacity risk data."
            />
            {data?.capacityRisk.missingRouting.length ? (
              <div className="mt-4 rounded-2xl border border-border/60 bg-bg-subtle/70 p-3 text-xs text-text-muted">
                Missing routing for:{" "}
                {data.capacityRisk.missingRouting
                  .map((item) => `${item.code} (${number.format(item.openQty)} ${item.unit})`)
                  .join(", ")}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SKU Profitability (Best)</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "revenue", label: "Revenue", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
                { key: "margin", label: "Margin", align: "right" }
              ]}
              rows={(data?.skuProfitability.top ?? []).map((row) => ({
                sku: `${row.code} · ${row.name}`,
                revenue: currency.format(row.revenue),
                cost: currency.format(row.cost),
                margin: `${currency.format(row.margin)} (${number.format(row.marginPct)}%)`
              }))}
              emptyLabel="No SKU profitability data."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SKU Profitability (Weak)</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "revenue", label: "Revenue", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
                { key: "margin", label: "Margin", align: "right" }
              ]}
              rows={(data?.skuProfitability.bottom ?? []).map((row) => ({
                sku: `${row.code} · ${row.name}`,
                revenue: currency.format(row.revenue),
                cost: currency.format(row.cost),
                margin: `${currency.format(row.margin)} (${number.format(row.marginPct)}%)`
              }))}
              emptyLabel="No weak SKU data."
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Machine Utilization</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "machine", label: "Machine" },
                { key: "util", label: "Util%", align: "right" },
                { key: "oee", label: "OEE%", align: "right" },
                { key: "yield", label: "Yield%", align: "right" },
                { key: "runs", label: "Runs", align: "right" },
                { key: "fix", label: "" }
              ]}
              rows={(data?.machineUtilization ?? []).map((row) => ({
                machine: `${row.code} · ${row.name}`,
                util: number.format(row.utilizationPct),
                oee: number.format(row.avgOee),
                yield: number.format(row.yieldPct),
                runs: row.runs,
                fix: (
                  <Link className="text-xs underline" href={row.fixPath}>
                    Open
                  </Link>
                )
              }))}
              emptyLabel="No machine utilization data."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee Performance (Selected Range)</CardTitle>
            <CardDescription>Rating out of 10 based on expected vs actual output.</CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "employee", label: "Employee" },
                { key: "minutes", label: "Minutes", align: "right" },
                { key: "expected", label: "Expected", align: "right" },
                { key: "actual", label: "Actual", align: "right" },
                { key: "performance", label: "Performance", align: "right" },
                { key: "rating", label: "Rating", align: "right" }
              ]}
              rows={(data?.employeePerformance.topEmployees ?? []).map((row) => ({
                employee: `${row.employeeCode} · ${row.employeeName}`,
                minutes: number.format(row.minutes),
                expected: number.format(row.expectedUnits),
                actual: number.format(row.actualUnits),
                performance: `${number.format(row.performancePct)}%`,
                rating: `${number.format(row.rating)}/10`
              }))}
              emptyLabel={loading ? "Loading employee metrics..." : "No employee performance data."}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Machine Effectiveness</CardTitle>
            <CardDescription>Downtime, throughput, and loss output by machine.</CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "machine", label: "Machine" },
                { key: "downtime", label: "Downtime (hrs)", align: "right" },
                { key: "throughput", label: "Good/Hr", align: "right" },
                { key: "loss", label: "Loss Qty", align: "right" },
                { key: "fix", label: "" }
              ]}
              rows={(data?.machineEffectiveness ?? []).map((row) => ({
                machine: `${row.code} · ${row.name}`,
                downtime: number.format(row.downtimeMinutes / 60),
                throughput: number.format(row.throughputPerHour),
                loss: number.format(row.lossQty),
                fix: (
                  <Link className="text-xs underline" href={row.fixPath}>
                    Open
                  </Link>
                )
              }))}
              emptyLabel="No machine effectiveness data."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production Yield by SKU</CardTitle>
            <CardDescription>Good vs reject/scrap distribution at SKU level.</CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "good", label: "Good", align: "right" },
                { key: "reject", label: "Reject", align: "right" },
                { key: "scrap", label: "Scrap", align: "right" },
                { key: "yield", label: "Yield %", align: "right" }
              ]}
              rows={(data?.productionYield.bySku ?? []).map((row) => ({
                sku: `${row.code} · ${row.name}`,
                good: number.format(row.good),
                reject: number.format(row.reject),
                scrap: number.format(row.scrap),
                yield: `${number.format(row.yieldPct)}%`
              }))}
              emptyLabel="No production yield data."
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Health: Dead Stock</CardTitle>
            <CardDescription>No movement for 90+ days.</CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "qty", label: "Qty", align: "right" },
                { key: "age", label: "Age (days)", align: "right" },
                { key: "fix", label: "" }
              ]}
              rows={(data?.inventoryHealth.deadStock ?? []).map((row) => ({
                sku: `${row.code} · ${row.name}`,
                qty: `${number.format(row.qty)} ${row.unit}`,
                age: row.ageDays,
                fix: (
                  <Link className="text-xs underline" href={row.fixPath}>
                    Fix
                  </Link>
                )
              }))}
              emptyLabel="No dead stock."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Health: Slow Moving</CardTitle>
            <CardDescription>Movement older than 30 days.</CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "qty", label: "Qty", align: "right" },
                { key: "age", label: "Age (days)", align: "right" },
                { key: "fix", label: "" }
              ]}
              rows={(data?.inventoryHealth.slowMoving ?? []).map((row) => ({
                sku: `${row.code} · ${row.name}`,
                qty: `${number.format(row.qty)} ${row.unit}`,
                age: row.ageDays,
                fix: (
                  <Link className="text-xs underline" href={row.fixPath}>
                    Fix
                  </Link>
                )
              }))}
              emptyLabel="No slow-moving stock."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Health: Stockout Risk</CardTitle>
            <CardDescription>Raw materials with less than 14 days of cover.</CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "Raw SKU" },
                { key: "onHand", label: "On Hand", align: "right" },
                { key: "usage", label: "Avg Daily Use", align: "right" },
                { key: "cover", label: "Days Cover", align: "right" },
                { key: "fix", label: "" }
              ]}
              rows={(data?.inventoryHealth.stockoutRisk ?? []).map((row) => ({
                sku: `${row.code} · ${row.name}`,
                onHand: `${number.format(row.onHand)} ${row.unit}`,
                usage: `${number.format(row.avgDailyUsage)} ${row.unit}`,
                cover: row.daysCover == null ? "—" : number.format(row.daysCover),
                fix: (
                  <Link className="text-xs underline" href={row.fixPath}>
                    Reorder
                  </Link>
                )
              }))}
              emptyLabel="No stockout risks."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Health: Raw Batch Aging</CardTitle>
            <CardDescription>Open raw batches older than 30 days.</CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "batch", label: "Batch" },
                { key: "sku", label: "SKU" },
                { key: "remaining", label: "Remaining", align: "right" },
                { key: "age", label: "Age (days)", align: "right" },
                { key: "fix", label: "" }
              ]}
              rows={(data?.inventoryHealth.rawBatchAging ?? []).map((row) => ({
                batch: row.batchNumber,
                sku: `${row.skuCode} · ${row.skuName}`,
                remaining: `${number.format(row.quantityRemaining)} ${row.unit}`,
                age: row.ageDays,
                fix: (
                  <Link className="text-xs underline" href={row.fixPath}>
                    Open
                  </Link>
                )
              }))}
              emptyLabel="No aged raw batches."
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Efficiency</CardTitle>
          <CardDescription>Top and bottom performers against team average.</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="mb-4 rounded-2xl border border-border/60 bg-bg-subtle/70 px-4 py-3 text-sm">
            Team Average Performance:{" "}
            <span className="font-semibold">{number.format(data?.employeeEfficiency.teamAveragePerformancePct ?? 0)}%</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <DataTable
              columns={[
                { key: "employee", label: "Top Performers" },
                { key: "performance", label: "Perf %", align: "right" },
                { key: "variance", label: "Vs Team", align: "right" },
                { key: "rating", label: "Rating", align: "right" }
              ]}
              rows={(data?.employeeEfficiency.top ?? []).map((row) => ({
                employee: `${row.employeeCode} · ${row.employeeName}`,
                performance: `${number.format(row.performancePct)}%`,
                variance: `${number.format(row.varianceFromTeamPct)}%`,
                rating: `${number.format(row.rating)}/10`
              }))}
              emptyLabel="No top employee data."
            />
            <DataTable
              columns={[
                { key: "employee", label: "Bottom Performers" },
                { key: "performance", label: "Perf %", align: "right" },
                { key: "variance", label: "Vs Team", align: "right" },
                { key: "rating", label: "Rating", align: "right" }
              ]}
              rows={(data?.employeeEfficiency.bottom ?? []).map((row) => ({
                employee: `${row.employeeCode} · ${row.employeeName}`,
                performance: `${number.format(row.performancePct)}%`,
                variance: `${number.format(row.varianceFromTeamPct)}%`,
                rating: `${number.format(row.rating)}/10`
              }))}
              emptyLabel="No bottom employee data."
            />
          </div>
        </CardBody>
      </Card>

      <Modal
        open={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        title={drilldown?.title ?? "Metric Breakdown"}
        className="max-w-6xl"
      >
        {drilldownLoading ? (
          <p>Loading breakdown...</p>
        ) : drilldownError ? (
          <p className="text-danger">{drilldownError}</p>
        ) : drilldown ? (
          <div className="space-y-4">
            <p>{drilldown.description}</p>
            <p className="text-xs text-text-muted">Source rows: {drilldown.sourceCount}</p>
            <DataTable columns={drilldown.columns} rows={drilldownRows} emptyLabel="No source rows found." />
            <div className="flex justify-end">
              <Link href={drilldown.modulePath} className="text-xs underline">
                Open module
              </Link>
            </div>
          </div>
        ) : (
          <p>No breakdown loaded.</p>
        )}
      </Modal>
    </div>
  );
}
