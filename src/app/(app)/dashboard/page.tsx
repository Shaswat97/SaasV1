"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";
import { DataTable } from "@/components/DataTable";
import { apiGet } from "@/lib/api-client";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SnapshotCard } from "@/components/dashboard/SnapshotCard";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { RecentAlerts } from "@/components/dashboard/RecentAlerts";
import { InsightsLibraryModal } from "@/components/dashboard/insights/InsightsLibraryModal";
import { DateFilter, getPresetRange } from "@/components/DateFilter";
import type { DateRange } from "@/components/DateFilter";
import {
  CreditCard,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  ChevronDown,
  Download,
  FileText,
  Printer,
  Sparkles
} from "lucide-react";

// Formatting
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
const currencyPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});
const currencyCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1
});
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const revenueChartPalette = ["#7c3aed", "#2563eb", "#14b8a6", "#f59e0b", "#ef4444", "#6366f1", "#94a3b8"];

type DashboardData = {
  cards: {
    orderBacklogValue: number;
    totalRevenue: number;
    deliveryCompletionPct: number;
    inventoryValue: number;
    avgOee: number;
    receivablesOutstanding: number;
    payablesOutstanding: number;
    unbilledDeliveredValue: number;
    openOrderToInvoiceConversionPct: number;
    collectionEfficiencyPct: number;
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
  revenueTrend: {
    daily: Array<{ key: string; label: string; revenue: number; cost: number; margin: number }>;
    weekly: Array<{ key: string; label: string; revenue: number; cost: number; margin: number }>;
  };
  revenueBreakdown: {
    bySku: Array<{
      skuId: string;
      code: string;
      name: string;
      qty: number;
      revenue: number;
      cost: number;
      margin: number;
      marginPct: number;
    }>;
    byCustomer: Array<{
      customerId: string;
      customerName: string;
      invoices: number;
      qty: number;
      revenue: number;
      cost: number;
      margin: number;
      marginPct: number;
    }>;
    byOrder: Array<{
      salesOrderId: string;
      soNumber: string;
      customerName: string;
      invoices: number;
      qty: number;
      revenue: number;
      cost: number;
      margin: number;
      marginPct: number;
    }>;
  };
  topSkus: Array<{ code: string; quantity: number }>;
  alerts: {
    delayedDeliveries: any[];
    overdueReceivables?: any[];
    overduePayables?: any[];
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
  const toLocalDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showRevenueDrilldown, setShowRevenueDrilldown] = useState(false);
  const [revenueView, setRevenueView] = useState<"customer" | "sku" | "order">("customer");
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange("current_month"));
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const fromDate = toLocalDate(dateRange.from);
  const toDate = toLocalDate(dateRange.to);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!exportMenuRef.current) return;
      if (!exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showExportMenu]);

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
    { label: `Outstanding (as of ${toDate})`, value: data ? fmt(data.collections.totalOutstanding) : "..." },
    { label: `Overdue (as of ${toDate})`, value: data ? fmt(data.collections.overdueOutstanding) : "...", color: "red" as const, highlight: true },
    { label: `Due in 7 days (from ${toDate})`, value: data ? fmt(data.collections.dueIn7Days) : "..." },
    { label: "Collected in range", value: data ? fmt(data.collections.collectedInRange) : "...", color: "green" as const },
  ];

  const payablesData = [
    { label: `Outstanding (as of ${toDate})`, value: data ? fmt(data.payables.totalOutstanding) : "..." },
    { label: `Overdue (as of ${toDate})`, value: data ? fmt(data.payables.overdueOutstanding) : "...", color: "red" as const, highlight: true },
    { label: `Due in 7 days (from ${toDate})`, value: data ? fmt(data.payables.dueIn7Days) : "..." },
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

  const revenueDrilldown = useMemo(() => {
    if (!data) {
      return {
        customerRows: [] as Array<Record<string, ReactNode>>,
        skuRows: [] as Array<Record<string, ReactNode>>,
        orderRows: [] as Array<Record<string, ReactNode>>
      };
    }

    const customerRows = data.revenueBreakdown.byCustomer.map((row) => ({
      customer: row.customerName,
      invoices: number.format(row.invoices),
      qty: number.format(row.qty),
      revenue: currencyPrecise.format(row.revenue),
      cost: currencyPrecise.format(row.cost),
      margin: (
        <span className={row.margin >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
          {currencyPrecise.format(row.margin)}
        </span>
      ),
      marginPct: `${number.format(row.marginPct)}%`
    }));

    const skuRows = data.revenueBreakdown.bySku.map((row) => {
      const spUnit = row.qty > 0 ? row.revenue / row.qty : 0;
      const cpUnit = row.qty > 0 ? row.cost / row.qty : 0;
      const marginUnit = row.qty > 0 ? row.margin / row.qty : 0;
      return {
        sku: `${row.code} · ${row.name}`,
        qty: number.format(row.qty),
        spUnit: currencyPrecise.format(spUnit),
        cpUnit: currencyPrecise.format(cpUnit),
        marginUnit: (
          <span className={marginUnit >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
            {currencyPrecise.format(marginUnit)}
          </span>
        ),
        revenue: currencyPrecise.format(row.revenue),
        cost: currencyPrecise.format(row.cost),
        margin: (
          <span className={row.margin >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
            {currencyPrecise.format(row.margin)}
          </span>
        ),
        marginPct: `${number.format(row.marginPct)}%`
      };
    });

    const orderRows = data.revenueBreakdown.byOrder.map((row) => ({
      order: row.soNumber,
      customer: row.customerName,
      invoices: number.format(row.invoices),
      qty: number.format(row.qty),
      revenue: currencyPrecise.format(row.revenue),
      cost: currencyPrecise.format(row.cost),
      margin: (
        <span className={row.margin >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
          {currencyPrecise.format(row.margin)}
        </span>
      ),
      marginPct: `${number.format(row.marginPct)}%`
    }));

    return { customerRows, skuRows, orderRows };
  }, [data]);

  const revenueVisuals = useMemo(() => {
    if (!data) {
      return {
        totalRevenue: 0,
        totalCost: 0,
        totalMargin: 0,
        totalMarginPct: 0,
        customerShareSegments: [] as Array<{
          label: string;
          value: number;
          pct: number;
          color: string;
        }>,
        customerShareGradient: "",
        topCustomerBars: [] as Array<{
          label: string;
          revenue: number;
          margin: number;
          revenuePct: number;
          marginPctOfTopRevenue: number;
        }>,
        skuUnitBars: [] as Array<{
          label: string;
          spUnit: number;
          cpUnit: number;
          spPct: number;
          cpPct: number;
          marginPct: number;
        }>,
        orderBars: [] as Array<{
          label: string;
          revenue: number;
          margin: number;
          revenuePct: number;
          marginPct: number;
        }>
      };
    }

    const totalRevenue = data.revenueSplit.finishedRevenue + data.revenueSplit.scrapRevenue;
    const totalMargin = data.revenueSplit.totalMargin;
    const totalCost = totalRevenue - totalMargin;
    const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    const customerRows = data.revenueBreakdown.byCustomer;
    const customerRevenueTotal = customerRows.reduce((sum, row) => sum + row.revenue, 0);
    const topCustomers = customerRows.slice(0, 5);
    const topCustomersRevenue = topCustomers.reduce((sum, row) => sum + row.revenue, 0);
    const othersRevenue = Math.max(customerRevenueTotal - topCustomersRevenue, 0);

    const customerShareSegments = topCustomers
      .map((row, idx) => ({
        label: row.customerName,
        value: row.revenue,
        pct: customerRevenueTotal > 0 ? (row.revenue / customerRevenueTotal) * 100 : 0,
        color: revenueChartPalette[idx % revenueChartPalette.length]
      }))
      .filter((row) => row.value > 0);

    if (othersRevenue > 0) {
      customerShareSegments.push({
        label: "Others",
        value: othersRevenue,
        pct: customerRevenueTotal > 0 ? (othersRevenue / customerRevenueTotal) * 100 : 0,
        color: revenueChartPalette[revenueChartPalette.length - 1]
      });
    }

    let currentPct = 0;
    const gradientStops = customerShareSegments.map((segment) => {
      const start = currentPct;
      currentPct += segment.pct;
      return `${segment.color} ${start}% ${currentPct}%`;
    });
    const customerShareGradient =
      gradientStops.length > 0
        ? `conic-gradient(${gradientStops.join(", ")})`
        : "conic-gradient(#e5e7eb 0% 100%)";

    const maxCustomerRevenue = Math.max(...customerRows.map((row) => row.revenue), 0);
    const topCustomerBars = customerRows.slice(0, 8).map((row) => ({
      label: row.customerName,
      revenue: row.revenue,
      margin: row.margin,
      revenuePct: maxCustomerRevenue > 0 ? (row.revenue / maxCustomerRevenue) * 100 : 0,
      marginPctOfTopRevenue: maxCustomerRevenue > 0 ? (row.margin / maxCustomerRevenue) * 100 : 0
    }));

    const skuRows = data.revenueBreakdown.bySku.slice(0, 8).map((row) => {
      const spUnit = row.qty > 0 ? row.revenue / row.qty : 0;
      const cpUnit = row.qty > 0 ? row.cost / row.qty : 0;
      return {
        label: row.code,
        spUnit,
        cpUnit,
        marginPct: row.marginPct
      };
    });
    const maxUnitValue = Math.max(...skuRows.flatMap((row) => [row.spUnit, row.cpUnit]), 0);
    const skuUnitBars = skuRows.map((row) => ({
      ...row,
      spPct: maxUnitValue > 0 ? (row.spUnit / maxUnitValue) * 100 : 0,
      cpPct: maxUnitValue > 0 ? (row.cpUnit / maxUnitValue) * 100 : 0
    }));

    const orderRows = data.revenueBreakdown.byOrder;
    const maxOrderRevenue = Math.max(...orderRows.map((row) => row.revenue), 0);
    const orderBars = orderRows.slice(0, 8).map((row) => ({
      label: row.soNumber,
      revenue: row.revenue,
      margin: row.margin,
      revenuePct: maxOrderRevenue > 0 ? (row.revenue / maxOrderRevenue) * 100 : 0,
      marginPct: row.marginPct
    }));

    return {
      totalRevenue,
      totalCost,
      totalMargin,
      totalMarginPct,
      customerShareSegments,
      customerShareGradient,
      topCustomerBars,
      skuUnitBars,
      orderBars
    };
  }, [data]);

  const revenueTrendVisuals = useMemo(() => {
    const series = data?.revenueTrend?.weekly ?? [];
    const maxRevenue = Math.max(...series.map((row) => row.revenue), 0);
    const maxMagnitude = Math.max(
      ...series.flatMap((row) => [Math.abs(row.revenue), Math.abs(row.margin)]),
      0
    );
    const totalRevenue = series.reduce((sum, row) => sum + row.revenue, 0);
    const totalMargin = series.reduce((sum, row) => sum + row.margin, 0);
    const avgRevenue = series.length > 0 ? totalRevenue / series.length : 0;
    const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
    const peakRevenue = [...series].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
    const weakestRevenue = [...series].sort((a, b) => a.revenue - b.revenue)[0] ?? null;

    return {
      series: series.map((row) => ({
        ...row,
        revenuePct: maxMagnitude > 0 ? (row.revenue / maxMagnitude) * 100 : 0,
        marginPctOfScale: maxMagnitude > 0 ? (Math.abs(row.margin) / maxMagnitude) * 100 : 0
      })),
      maxRevenue,
      totalRevenue,
      avgRevenue,
      avgMarginPct,
      peakRevenue,
      weakestRevenue
    };
  }, [data]);

  const executiveSummary = useMemo(() => {
    if (!data) return [];
    const bullets: string[] = [];
    if ((data.alerts.lowStock?.length ?? 0) > 0) {
      bullets.push(`${data.alerts.lowStock.length} low-stock item(s) need purchase or production planning.`);
    } else {
      bullets.push("No low-stock alerts in the current dashboard view.");
    }
    if ((data.alerts.delayedDeliveries?.length ?? 0) > 0) {
      bullets.push(`${data.alerts.delayedDeliveries.length} delayed delivery alert(s) need dispatch follow-up.`);
    } else {
      bullets.push("No delayed delivery alerts in the selected period.");
    }
    if (data.cards.receivablesOutstanding > data.cards.payablesOutstanding) {
      bullets.push("Receivables are higher than payables, so collection follow-up can improve cash position.");
    } else if (data.cards.payablesOutstanding > data.cards.receivablesOutstanding) {
      bullets.push("Payables are higher than receivables, so payment planning needs close monitoring.");
    } else {
      bullets.push("Receivables and payables are currently balanced.");
    }
    if (data.cards.deliveryCompletionPct < 80) {
      bullets.push("Delivery completion is below 80%; review production and dispatch bottlenecks.");
    }
    if (data.cards.avgOee > 0 && data.cards.avgOee < 60) {
      bullets.push("Average OEE is low; check machine utilization, rejects, and stoppages.");
    }
    return bullets.slice(0, 5);
  }, [data]);

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildDashboardCsv() {
    if (!data) return "";
    const rows: string[][] = [];
    rows.push(["Section", "Metric", "Value"]);
    rows.push(["Range", "From", fromDate]);
    rows.push(["Range", "To", toDate]);
    rows.push(["KPI", "Order Backlog", String(data.cards.orderBacklogValue)]);
    rows.push(["KPI", "Total Revenue", String(data.cards.totalRevenue)]);
    rows.push(["KPI", "Inventory Value", String(data.cards.inventoryValue)]);
    rows.push(["KPI", "Receivables", String(data.cards.receivablesOutstanding)]);
    rows.push(["KPI", "Payables", String(data.cards.payablesOutstanding)]);
    rows.push(["KPI", "Avg OEE", String(data.cards.avgOee)]);
    rows.push(["KPI", "Delivery Completion %", String(data.cards.deliveryCompletionPct)]);
    rows.push(["Collections", "Outstanding", String(data.collections.totalOutstanding)]);
    rows.push(["Collections", "Overdue", String(data.collections.overdueOutstanding)]);
    rows.push(["Collections", "Due in 7 days", String(data.collections.dueIn7Days)]);
    rows.push(["Collections", "Collected in range", String(data.collections.collectedInRange)]);
    rows.push(["Payables", "Outstanding", String(data.payables.totalOutstanding)]);
    rows.push(["Payables", "Overdue", String(data.payables.overdueOutstanding)]);
    rows.push(["Payables", "Due in 7 days", String(data.payables.dueIn7Days)]);
    rows.push(["Payables", "Paid in range", String(data.payables.paidInRange)]);
    rows.push(["Production", "Good Qty", String(data.productionOutput.goodQty)]);
    rows.push(["Production", "Reject Qty", String(data.productionOutput.rejectQty)]);
    rows.push(["Production", "Scrap Qty", String(data.productionOutput.scrapQty)]);
    rows.push(["Production", "Yield %", String(data.productionOutput.yieldPct)]);
    rows.push(["Revenue Split", "Finished Revenue", String(data.revenueSplit.finishedRevenue)]);
    rows.push(["Revenue Split", "Scrap Revenue", String(data.revenueSplit.scrapRevenue)]);
    rows.push(["Revenue Split", "Scrap Share %", String(data.revenueSplit.scrapSharePct)]);
    rows.push(["Revenue Split", "Total Margin", String(data.revenueSplit.totalMargin)]);

    rows.push([]);
    rows.push(["Low Stock", "SKU", "On Hand", "Threshold", "Shortage", "Unit", "Type"]);
    data.alerts.lowStock.forEach((item) => {
      rows.push([
        "Low Stock",
        `${item.code} - ${item.name}`,
        String(item.onHand),
        String(item.threshold),
        String(item.shortage),
        item.unit,
        item.skuType
      ]);
    });

    return rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
  }

  function downloadCsvExport() {
    if (!data) return;
    const csv = buildDashboardCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-export-${fromDate}_to_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }

  function buildExecutiveHtml(options: { autoPrint: boolean; variant?: "executive" | "print" }) {
    if (!data) return "";
    const variant = options.variant ?? "executive";
    const isExecutive = variant === "executive";
    const rangeLabel = `${fromDate} to ${toDate}`;
    const generatedAt = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const revenueVsPayablesGap = data.cards.receivablesOutstanding - data.cards.payablesOutstanding;
    const serviceStatus =
      data.cards.deliveryCompletionPct >= 90 ? "Strong" : data.cards.deliveryCompletionPct >= 75 ? "Watch" : "Risk";
    const opsStatus = data.cards.avgOee >= 75 ? "Strong" : data.cards.avgOee >= 60 ? "Watch" : "Risk";
    const stockStatus = (data.alerts.lowStock?.length ?? 0) === 0 ? "Strong" : data.alerts.lowStock.length <= 3 ? "Watch" : "Risk";
    const topSkuRows = (data.topSkus ?? [])
      .slice(0, 8)
      .map((row, index) => {
        const maxQty = Math.max(1, ...(data.topSkus ?? []).map((item) => item.quantity));
        const barPct = Math.max(8, Math.round((row.quantity / maxQty) * 100));
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.code)}</td>
            <td style="text-align:right">${number.format(row.quantity)}</td>
            <td>
              <div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
                <div style="height:100%;width:${barPct}%;background:linear-gradient(90deg,#7c3aed,#2563eb);"></div>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
    const lowStockRows = data.alerts.lowStock.length
      ? data.alerts.lowStock
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.code)}</td>
                <td>${escapeHtml(item.name)}</td>
                <td style="text-align:right">${number.format(item.onHand)} ${escapeHtml(item.unit)}</td>
                <td style="text-align:right">${number.format(item.threshold)} ${escapeHtml(item.unit)}</td>
                <td style="text-align:right;color:${item.shortage > 0 ? "#b91c1c" : "#475569"}">${number.format(item.shortage)} ${escapeHtml(item.unit)}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="5" style="color:#64748b">No low stock alerts in this period.</td></tr>`;

    const delayedRows = (data.alerts.delayedDeliveries ?? []).length
      ? (data.alerts.delayedDeliveries ?? [])
          .slice(0, 8)
          .map((row: any) => {
            const so = row.soNumber ?? "—";
            const customer = row.customer ?? "—";
            const sku = row.sku ?? "—";
            const openQty = row.openQty ?? 0;
            const daysOpen = row.daysOpen ?? 0;
            return `
              <tr>
                <td>${escapeHtml(String(so))}</td>
                <td>${escapeHtml(String(customer))}</td>
                <td>${escapeHtml(String(sku))}</td>
                <td style="text-align:right">${number.format(Number(openQty) || 0)}</td>
                <td style="text-align:right">${number.format(Number(daysOpen) || 0)}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="5" style="color:#64748b">No delayed delivery alerts in this period.</td></tr>`;

    const actionRows = [
      (data.alerts.lowStock?.length ?? 0) > 0
        ? `Create purchase or production plan for ${data.alerts.lowStock.length} low-stock item(s).`
        : "No urgent stock replenishment action needed from current low-stock alerts.",
      (data.alerts.delayedDeliveries?.length ?? 0) > 0
        ? `Review delayed deliveries and confirm dispatch dates with customers.`
        : "No delayed delivery follow-up required in current alert view.",
      revenueVsPayablesGap < 0
        ? "Prioritize cashflow planning: payables are higher than receivables."
        : "Follow up collections to convert receivables into cash faster.",
      data.cards.avgOee < 60
        ? "Check machine utilization and reject reasons to improve OEE."
        : "Maintain current machine performance and monitor OEE trend weekly."
    ];

    const pageTitle = isExecutive ? "Executive Dashboard Report" : "Dashboard Report";
    const pageSubtitle =
      isExecutive
        ? "Management-ready summary for fast review, decisions, and PDF sharing"
        : "Readable on-screen report with quick section links, ready to print/share";
    const accent1 = isExecutive ? "#7c3aed" : "#2563eb";
    const accent2 = isExecutive ? "#2563eb" : "#0ea5e9";
    const toolbarHtml = !isExecutive
      ? `
  <div class="toolbar no-print">
    <button onclick="window.print()" class="toolbar-btn primary">Print / Save PDF</button>
    <button onclick="window.scrollTo({ top: 0, behavior: 'smooth' })" class="toolbar-btn">Top</button>
    <span class="toolbar-meta">Range: ${escapeHtml(rangeLabel)} · Generated ${escapeHtml(generatedAt)}</span>
  </div>
      `
      : "";
    const tocHtml = !isExecutive
      ? `
  <div class="toc no-print">
    <a href="#section-summary">Summary</a>
    <a href="#section-attention">Attention</a>
    <a href="#section-actions">Actions</a>
    <a href="#section-finance">Finance</a>
    <a href="#section-ops">Ops Split</a>
    <a href="#section-alerts">Alerts</a>
  </div>
      `
      : "";

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>TechnoSync ${escapeHtml(pageTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; color: #0f172a; background: #ffffff; }
    h1,h2,h3,p { margin: 0; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; }
    .toolbar { position: sticky; top: 0; z-index: 40; display:flex; flex-wrap:wrap; gap:8px; align-items:center; border:1px solid #e2e8f0; border-radius: 14px; padding:10px; background: rgba(255,255,255,0.92); backdrop-filter: blur(4px); margin-bottom: 12px; }
    .toolbar-btn { border:1px solid #cbd5e1; background:#fff; color:#334155; border-radius: 999px; padding:8px 12px; font-size:12px; font-weight:600; cursor:pointer; }
    .toolbar-btn.primary { background: linear-gradient(135deg, ${accent1}, ${accent2}); color: #fff; border-color: transparent; }
    .toolbar-meta { font-size: 11px; color:#64748b; margin-left:auto; }
    .toc { display:flex; flex-wrap:wrap; gap:8px; margin-bottom: 14px; }
    .toc a { text-decoration:none; border:1px solid #dbeafe; background:#eff6ff; color:#1d4ed8; border-radius:999px; padding:6px 10px; font-size:11px; font-weight:600; }
    .hero { border:1px solid #e2e8f0; border-radius: 18px; padding: 16px; background: linear-gradient(135deg, ${accent1}14, ${accent2}10); margin-bottom: 16px; }
    .brand { font-size:12px; color:#64748b; letter-spacing:0.14em; text-transform:uppercase; }
    .title { font-size:28px; font-weight:700; margin-top:6px; line-height:1.15; }
    .subtitle { color:#475569; margin-top:6px; }
    .meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .meta-chip { border:1px solid #cbd5e1; border-radius:999px; padding:6px 10px; font-size:11px; color:#334155; background:#fff; }
    .range { border:1px solid #cbd5e1; border-radius:999px; padding:8px 12px; font-size:12px; color:#334155; }
    .grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:12px; margin-bottom:18px; }
    .card { border:1px solid #e2e8f0; border-radius:14px; padding:12px; }
    .label { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.08em; }
    .value { font-size:22px; font-weight:700; margin-top:6px; }
    .sub { font-size:12px; color:#64748b; margin-top:4px; }
    .health-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:12px; margin-bottom:18px; }
    .health { border:1px solid #e2e8f0; border-radius:14px; padding:12px; background:#fff; }
    .health-title { font-size:12px; color:#475569; }
    .health-status { margin-top:8px; display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; font-size:11px; font-weight:600; }
    .health-status.strong { background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; }
    .health-status.watch { background:#fffbeb; color:#b45309; border:1px solid #fde68a; }
    .health-status.risk { background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
    .section { margin-top:16px; }
    .section h2 { font-size:16px; font-weight:700; margin-bottom:8px; }
    .bullets { border:1px solid #e2e8f0; border-radius:14px; padding:10px 14px; background:#f8fafc; }
    .bullets li { margin: 6px 0; color:#334155; }
    table { width:100%; border-collapse: collapse; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
    th, td { font-size:12px; padding:10px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
    th { text-align:left; background:#f8fafc; color:#475569; text-transform:uppercase; letter-spacing:0.06em; font-size:11px; }
    tr:last-child td { border-bottom:none; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .three-col { display:grid; grid-template-columns:1.1fr 1.1fr 0.8fr; gap:14px; }
    .kicker { font-size:10px; color:#64748b; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:6px; }
    .note { color:#64748b; font-size:11px; margin-top:12px; }
    .page-break { break-before: page; page-break-before: always; }
    .section-block { scroll-margin-top: 72px; }
    @media (max-width: 980px) {
      .grid, .two-col, .three-col, .health-grid { grid-template-columns:1fr; }
      .toolbar-meta { width: 100%; margin-left: 0; }
    }
    @media print {
      body { margin: 12px; }
      .no-print { display:none; }
      .page-break { break-before: page; page-break-before: always; }
    }
  </style>
</head>
<body>
  ${toolbarHtml}
  <div class="header">
    <div>
      <div class="brand">TechnoSync</div>
      <div class="title">${escapeHtml(pageTitle)}</div>
      <div class="subtitle">${escapeHtml(pageSubtitle)}</div>
    </div>
    <div class="range">Range: ${escapeHtml(rangeLabel)}</div>
  </div>

  ${tocHtml}

  <div class="hero section-block" id="section-summary">
    <div class="kicker">Snapshot</div>
    <div style="font-size:18px;font-weight:700;line-height:1.3;">
      ${data.alerts.lowStock.length > 0
        ? `There are ${data.alerts.lowStock.length} low-stock alert(s) and ${data.alerts.delayedDeliveries.length} delayed delivery alert(s) needing attention.`
        : `Operations are stable in the selected range with no low-stock alerts currently visible.`}
    </div>
    <div class="meta">
      <span class="meta-chip">Generated: ${escapeHtml(generatedAt)}</span>
      <span class="meta-chip">Currency: INR (₹)</span>
      <span class="meta-chip">Source: Dashboard filtered range</span>
    </div>
  </div>

  <div class="grid">
    <div class="card"><div class="label">Total Revenue</div><div class="value">${escapeHtml(fmt(data.cards.totalRevenue))}</div><div class="sub">Selected range</div></div>
    <div class="card"><div class="label">Inventory Value</div><div class="value">${escapeHtml(fmt(data.cards.inventoryValue))}</div><div class="sub">Across all zones</div></div>
    <div class="card"><div class="label">Order Backlog</div><div class="value">${escapeHtml(fmt(data.cards.orderBacklogValue))}</div><div class="sub">Open order value</div></div>
    <div class="card"><div class="label">Receivables</div><div class="value">${escapeHtml(fmt(data.cards.receivablesOutstanding))}</div><div class="sub">Outstanding</div></div>
    <div class="card"><div class="label">Payables</div><div class="value">${escapeHtml(fmt(data.cards.payablesOutstanding))}</div><div class="sub">Outstanding</div></div>
    <div class="card"><div class="label">Operations Health</div><div class="value">${escapeHtml(number.format(data.cards.deliveryCompletionPct))}% / ${escapeHtml(number.format(data.cards.avgOee))}%</div><div class="sub">Delivery completion / Avg OEE</div></div>
  </div>

  <div class="health-grid">
    <div class="health">
      <div class="health-title">Service Reliability</div>
      <div class="health-status ${serviceStatus.toLowerCase()}">${serviceStatus}</div>
      <div class="sub">${escapeHtml(number.format(data.cards.deliveryCompletionPct))}% delivery completion in selected period</div>
    </div>
    <div class="health">
      <div class="health-title">Operations Efficiency</div>
      <div class="health-status ${opsStatus.toLowerCase()}">${opsStatus}</div>
      <div class="sub">${escapeHtml(number.format(data.cards.avgOee))}% average OEE</div>
    </div>
    <div class="health">
      <div class="health-title">Inventory Readiness</div>
      <div class="health-status ${stockStatus.toLowerCase()}">${stockStatus}</div>
      <div class="sub">${data.alerts.lowStock.length} low-stock alert(s)</div>
    </div>
  </div>

  <div class="section section-block" id="section-attention">
    <h2>What Needs Attention</h2>
    <div class="bullets">
      <ul>
        ${executiveSummary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  </div>

  <div class="section section-block" id="section-actions">
    <h2>Recommended Actions (Next 24 Hours)</h2>
    <div class="bullets" style="background:#ffffff;">
      <ol style="margin:0;padding-left:18px;">
        ${actionRows.map((item) => `<li style="margin:6px 0;color:#334155;">${escapeHtml(item)}</li>`).join("")}
      </ol>
    </div>
  </div>

  <div class="section two-col section-block" id="section-finance">
    <div class="card">
      <h2 style="margin-bottom:8px">Collections Snapshot</h2>
      <table>
        <tr><th>Metric</th><th style="text-align:right">Value</th></tr>
        <tr><td>Outstanding</td><td style="text-align:right">${escapeHtml(fmt(data.collections.totalOutstanding))}</td></tr>
        <tr><td>Overdue</td><td style="text-align:right">${escapeHtml(fmt(data.collections.overdueOutstanding))}</td></tr>
        <tr><td>Due in 7 days</td><td style="text-align:right">${escapeHtml(fmt(data.collections.dueIn7Days))}</td></tr>
        <tr><td>Collected in range</td><td style="text-align:right">${escapeHtml(fmt(data.collections.collectedInRange))}</td></tr>
      </table>
    </div>
    <div class="card">
      <h2 style="margin-bottom:8px">Payables Snapshot</h2>
      <table>
        <tr><th>Metric</th><th style="text-align:right">Value</th></tr>
        <tr><td>Outstanding</td><td style="text-align:right">${escapeHtml(fmt(data.payables.totalOutstanding))}</td></tr>
        <tr><td>Overdue</td><td style="text-align:right">${escapeHtml(fmt(data.payables.overdueOutstanding))}</td></tr>
        <tr><td>Due in 7 days</td><td style="text-align:right">${escapeHtml(fmt(data.payables.dueIn7Days))}</td></tr>
        <tr><td>Paid in range</td><td style="text-align:right">${escapeHtml(fmt(data.payables.paidInRange))}</td></tr>
      </table>
    </div>
  </div>

  <div class="section three-col section-block" id="section-ops">
    <div class="card">
      <h2 style="margin-bottom:8px">Production Output Split</h2>
      <table>
        <tr><th>Metric</th><th style="text-align:right">Value</th></tr>
        <tr><td>Good Qty</td><td style="text-align:right">${escapeHtml(number.format(data.productionOutput.goodQty))}</td></tr>
        <tr><td>Reject Qty</td><td style="text-align:right">${escapeHtml(number.format(data.productionOutput.rejectQty))}</td></tr>
        <tr><td>Scrap Qty</td><td style="text-align:right">${escapeHtml(number.format(data.productionOutput.scrapQty))}</td></tr>
        <tr><td>Yield %</td><td style="text-align:right">${escapeHtml(number.format(data.productionOutput.yieldPct))}%</td></tr>
      </table>
    </div>
    <div class="card">
      <h2 style="margin-bottom:8px">Revenue Split</h2>
      <table>
        <tr><th>Metric</th><th style="text-align:right">Value</th></tr>
        <tr><td>Finished Revenue</td><td style="text-align:right">${escapeHtml(fmt(data.revenueSplit.finishedRevenue))}</td></tr>
        <tr><td>Scrap Revenue</td><td style="text-align:right">${escapeHtml(fmt(data.revenueSplit.scrapRevenue))}</td></tr>
        <tr><td>Scrap Share %</td><td style="text-align:right">${escapeHtml(number.format(data.revenueSplit.scrapSharePct))}%</td></tr>
        <tr><td>Total Margin</td><td style="text-align:right">${escapeHtml(fmt(data.revenueSplit.totalMargin))}</td></tr>
      </table>
    </div>
    <div class="card">
      <h2 style="margin-bottom:8px">Top SKUs</h2>
      <table>
        <tr><th>#</th><th>SKU</th><th style="text-align:right">Qty</th><th>Share</th></tr>
        ${topSkuRows || `<tr><td colspan="4" style="color:#64748b">No top SKU data in this range.</td></tr>`}
      </table>
    </div>
  </div>

  <div class="section two-col section-block ${isExecutive ? "page-break" : ""}" id="section-alerts">
    <div class="card">
      <h2 style="margin-bottom:8px">Low Stock Alerts</h2>
      <table>
        <tr><th>Code</th><th>Name</th><th style="text-align:right">On Hand</th><th style="text-align:right">Threshold</th><th style="text-align:right">Shortage</th></tr>
        ${lowStockRows}
      </table>
    </div>
    <div class="card">
      <h2 style="margin-bottom:8px">Delayed Deliveries</h2>
      <table>
        <tr><th>SO</th><th>Customer</th><th>SKU</th><th style="text-align:right">Open Qty</th><th style="text-align:right">Days Open</th></tr>
        ${delayedRows}
      </table>
    </div>
  </div>

  <p class="note">Generated from TechnoSync dashboard for ${escapeHtml(rangeLabel)} on ${escapeHtml(generatedAt)}. Values shown in INR where applicable.</p>

  ${options.autoPrint ? `<script>window.onload = () => { setTimeout(() => window.print(), 250); };</script>` : ""}
</body>
</html>`;
    return html;
  }

  function openHtmlReport(autoPrint: boolean, variant: "executive" | "print" = "print") {
    if (!data) return;
    const popup = window.open("", "_blank");
    if (!popup) return;
    try {
      popup.opener = null;
    } catch {
      // Ignore if browser blocks setting opener.
    }
    popup.document.open();
    popup.document.write(buildExecutiveHtml({ autoPrint, variant }));
    popup.document.close();
    setShowExportMenu(false);
  }

  function openExecutivePdfReport() {
    openHtmlReport(true, "executive");
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateFilter value={dateRange} onChange={(range) => setDateRange(range)} defaultPreset="current_month" />

          <button
            onClick={() => setShowInsights(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Get Insights
          </button>

          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu((current) => !current)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            {showExportMenu ? (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={openExecutivePdfReport}
                  disabled={!data}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="mt-0.5 h-4 w-4 text-gray-600" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Executive PDF Report</span>
                    <span className="block text-xs text-gray-500">Management summary with actions and alerts (opens print-to-PDF)</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openHtmlReport(false, "print")}
                  disabled={!data}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileText className="mt-0.5 h-4 w-4 text-gray-600" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Print-friendly HTML</span>
                    <span className="block text-xs text-gray-500">Open readable report page, then print/share</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={downloadCsvExport}
                  disabled={!data}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="mt-0.5 h-4 w-4 text-gray-600" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">CSV (Raw Data)</span>
                    <span className="block text-xs text-gray-500">Detailed dashboard values and low-stock rows</span>
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Row 1: Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Order Backlog"
          value={data ? currency.format(data.cards.orderBacklogValue) : "..."}
          scopeLabel="In range"
          trend={data ? `${number.format(data.cards.deliveryCompletionPct)}% delivered` : "..."}
          trendDirection="flat"
          subtext="Open order value (not yet fully delivered/invoiced)"
          icon={Package}
          iconColor="text-purple-500"
        />
        <MetricCard
          label="Total Revenue"
          value={data ? currency.format(data.cards.totalRevenue) : "..."}
          scopeLabel="In range"
          trend={`${fromDate} - ${toDate}`}
          trendDirection="flat"
          subtext=""
          icon={CreditCard}
          iconColor="text-blue-500"
        />
        <MetricCard
          label="Inventory Value"
          value={data ? currency.format(data.cards.inventoryValue) : "..."}
          scopeLabel={`As of ${toDate}`}
          trend={`As of ${toDate}`}
          trendDirection="flat"
          subtext=""
          icon={ShoppingCart}
          iconColor="text-amber-500"
        />
        <MetricCard
          label="Receivables (Outstanding)"
          value={data ? currency.format(data.cards.receivablesOutstanding) : "..."}
          scopeLabel={`As of ${toDate}`}
          trend={`As of ${toDate}`}
          trendDirection="flat"
          subtext={
            data
              ? `Overdue ${currencyCompact.format(data.collections.overdueOutstanding)} · Collected ${currencyCompact.format(data.collections.collectedInRange)} in range`
              : ""
          }
          icon={TrendingUp}
          iconColor="text-green-500"
        />
      </div>

      {/* Row 2: Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Payables (Outstanding)"
          value={data ? currency.format(data.cards.payablesOutstanding) : "..."}
          scopeLabel={`As of ${toDate}`}
          trend={`As of ${toDate}`}
          trendDirection="flat"
          subtext={
            data
              ? `Overdue ${currencyCompact.format(data.payables.overdueOutstanding)} · Paid ${currencyCompact.format(data.payables.paidInRange)} in range`
              : ""
          }
          icon={TrendingDown}
          iconColor="text-red-500"
        />
        <MetricCard
          label="Avg. OEE"
          value={data ? `${number.format(data.cards.avgOee)}%` : "..."}
          scopeLabel="In range"
          trend="Selected range"
          trendDirection="flat"
          subtext=""
          icon={CheckCircle}
          iconColor="text-emerald-500"
        />
        <MetricCard
          label="Delivery Completion"
          value={data ? `${number.format(data.cards.deliveryCompletionPct)}%` : "..."}
          scopeLabel="In range"
          trend="Open orders"
          trendDirection="flat"
          subtext=""
          icon={Clock}
          iconColor="text-gray-500"
        />
        <MetricCard
          label="Unbilled Delivered Value"
          value={data ? currency.format(data.cards.unbilledDeliveredValue) : "..."}
          scopeLabel={`As of ${toDate}`}
          trend={`As of ${toDate}`}
          trendDirection="flat"
          subtext="Delivered qty value not yet invoiced"
          icon={AlertCircle}
          iconColor="text-orange-500"
        />
      </div>

      {/* Row 2.5: Conversion / Collection Decision Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          label="Order → Invoice Conversion %"
          value={data ? `${number.format(data.cards.openOrderToInvoiceConversionPct)}%` : "..."}
          scopeLabel={`As of ${toDate}`}
          trend="Orders created in selected range"
          trendDirection="flat"
          subtext={
            data
              ? `${currencyCompact.format(data.cards.orderBacklogValue)} backlog still open in range`
              : ""
          }
          icon={FileText}
          iconColor="text-indigo-500"
        />
        <MetricCard
          label="Collection Efficiency %"
          value={data ? `${number.format(data.cards.collectionEfficiencyPct)}%` : "..."}
          scopeLabel="In range"
          trend="Collected / billed in selected range"
          trendDirection="flat"
          subtext={
            data
              ? `Collected ${currencyCompact.format(data.collections.collectedInRange)} vs billed ${currencyCompact.format(data.cards.totalRevenue)}`
              : ""
          }
          icon={CreditCard}
          iconColor="text-emerald-500"
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-white/70 px-4 py-3 text-xs text-text-muted">
        <span className="font-medium text-text">How to read this:</span>{" "}
        <span>
          <span className="font-medium">Order Backlog</span> = open order value in the selected range (operational pipeline).{" "}
          <span className="font-medium">Receivables / Payables</span> = invoiced/billed outstanding amount as of the selected end date.{" "}
          Amounts already collected/paid in the range are shown in the snapshot cards and hero subtext.
        </span>
      </div>

      {/* Row 3: Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SnapshotCard title="Collections Snapshot" items={collectionsData} scopeLabel="Mixed" />
        <SnapshotCard title="Payables Snapshot" items={payablesData} scopeLabel="Mixed" />
        <SnapshotCard title="Production Output Split" items={productionSplitData} scopeLabel="In range" />
        <SnapshotCard
          title="Revenue Split"
          items={revenueSplitData}
          scopeLabel="In range"
          onClick={() => {
            setRevenueView("customer");
            setShowRevenueDrilldown(true);
          }}
          hint="Click for details"
        />
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
              count: data
                ? (data.alerts?.delayedDeliveries?.length || 0) +
                  (data.alerts?.overdueReceivables?.length || 0) +
                  (data.alerts?.overduePayables?.length || 0)
                : 0,
              content: (
                <div className="p-6">
                  <div className="mb-3 text-xs text-text-muted">
                    Receivable/payable alerts are calculated <span className="font-medium text-text">as of {toDate}</span>. Delivery alerts remain operational (current open orders).
                  </div>
                  {data && <RecentAlerts alerts={data.alerts} />}
                </div>
              )
            },
            {
              id: "stock",
              label: "Low Stock",
              count: data ? (data.alerts?.lowStock?.length || 0) : 0,
              content: (
                <div className="p-6">
                  <div className="mb-3 text-xs text-text-muted">
                    Low stock is shown <span className="font-medium text-text">as of {toDate}</span> using stock movements up to the selected end date.
                  </div>
                  <DataTable
                    columns={[
                      { key: "sku", label: "Item" },
                      { key: "type", label: "Type" },
                      { key: "onHand", label: "On Hand", align: "right" },
                      { key: "threshold", label: "Threshold", align: "right" },
                      { key: "shortage", label: "Shortage", align: "right" }
                    ]}
                    rows={(data?.alerts?.lowStock ?? []).map((item) => ({
                      sku: `${item.code} · ${item.name}`,
                      type: item.skuType,
                      onHand: `${number.format(item.onHand)} ${item.unit}`,
                      threshold: `${number.format(item.threshold)} ${item.unit}`,
                      shortage: (
                        <span className={item.shortage > 0 ? "font-semibold text-red-600" : "text-gray-500"}>
                          {number.format(item.shortage)} {item.unit}
                        </span>
                      )
                    }))}
                    emptyLabel={loading ? "Loading low stock items..." : "No low stock items."}
                    className="border-none shadow-none"
                  />
                </div>
              )
            },
            { id: "downtime", label: "Machine Downtime", count: 0, content: <div className="p-6 text-sm text-gray-500">No downtime recorded.</div> },
          ]}
        />
      </div>

      {/* Business Insights Modal */}
      <InsightsLibraryModal isOpen={showInsights} onClose={() => setShowInsights(false)} />

      <Modal
        open={showRevenueDrilldown}
        onClose={() => setShowRevenueDrilldown(false)}
        title="Revenue Split Drilldown"
        className="max-w-6xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-bg-subtle/20 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-text-muted">
              <span className="rounded-full border border-border/60 bg-white px-2.5 py-1">
                Range: {fromDate} to {toDate}
              </span>
              <span className="rounded-full border border-border/60 bg-white px-2.5 py-1">
                Finished Revenue: {data ? currency.format(data.revenueSplit.finishedRevenue) : "..."}
              </span>
              <span className="rounded-full border border-border/60 bg-white px-2.5 py-1">
                Scrap Revenue: {data ? currency.format(data.revenueSplit.scrapRevenue) : "..."}
              </span>
              <span className="rounded-full border border-border/60 bg-white px-2.5 py-1">
                Total Margin: {data ? currency.format(data.revenueSplit.totalMargin) : "..."}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-text-muted">
              Revenue and margin are shown for the selected date range. Cost side uses actual production cost where available
              (raw batch cost + labor + machine overhead), otherwise falls back to expected raw cost.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/60 bg-white p-4">
              <div className="text-xs uppercase tracking-wider text-text-muted">Total Revenue</div>
              <div className="mt-1 text-xl font-semibold text-text">
                {currency.format(revenueVisuals.totalRevenue)}
              </div>
              <div className="mt-2 text-xs text-text-muted">Finished + scrap revenue in selected range</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white p-4">
              <div className="text-xs uppercase tracking-wider text-text-muted">Final Mfg Cost</div>
              <div className="mt-1 text-xl font-semibold text-text">
                {currency.format(revenueVisuals.totalCost)}
              </div>
              <div className="mt-2 text-xs text-text-muted">Actual raw + labor + machine overhead (fallback to expected raw)</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white p-4">
              <div className="text-xs uppercase tracking-wider text-text-muted">Total Margin</div>
              <div className={["mt-1 text-xl font-semibold", revenueVisuals.totalMargin >= 0 ? "text-green-700" : "text-red-600"].join(" ")}>
                {currency.format(revenueVisuals.totalMargin)}
              </div>
              <div className="mt-2 text-xs text-text-muted">Revenue minus final manufacturing cost</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white p-4">
              <div className="text-xs uppercase tracking-wider text-text-muted">Margin %</div>
              <div className={["mt-1 text-xl font-semibold", revenueVisuals.totalMarginPct >= 0 ? "text-green-700" : "text-red-600"].join(" ")}>
                {number.format(revenueVisuals.totalMarginPct)}%
              </div>
              <div className="mt-2 text-xs text-text-muted">Contribution margin percentage</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-text">Revenue Trend (Weekly)</div>
                <div className="mt-1 text-xs text-text-muted">
                  Purple bar = revenue, green marker = margin, red marker = negative margin
                </div>
              </div>
              <div className="rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs font-medium text-text-muted">
                Weekly view
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-bg-subtle/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-text-muted">Peak Week</div>
                <div className="mt-1 text-sm font-semibold text-text">
                  {revenueTrendVisuals.peakRevenue ? revenueTrendVisuals.peakRevenue.label : "—"}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {revenueTrendVisuals.peakRevenue ? currencyCompact.format(revenueTrendVisuals.peakRevenue.revenue) : "No data"}
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-bg-subtle/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-text-muted">Average Revenue / week</div>
                <div className="mt-1 text-sm font-semibold text-text">{currencyCompact.format(revenueTrendVisuals.avgRevenue)}</div>
                <div className="mt-1 text-xs text-text-muted">
                  Avg margin {number.format(revenueTrendVisuals.avgMarginPct)}%
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-bg-subtle/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-text-muted">Lowest Revenue Week</div>
                <div className="mt-1 text-sm font-semibold text-text">
                  {revenueTrendVisuals.weakestRevenue ? revenueTrendVisuals.weakestRevenue.label : "—"}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {revenueTrendVisuals.weakestRevenue ? currencyCompact.format(revenueTrendVisuals.weakestRevenue.revenue) : "No data"}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border/50 bg-bg-subtle/5 p-4">
              {revenueTrendVisuals.series.length === 0 ? (
                <div className="text-xs text-text-muted">No revenue trend data in this range.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {revenueTrendVisuals.series.map((point) => (
                    <div key={point.key} className="rounded-xl border border-border/40 bg-white/80 p-3">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-medium text-text">{point.label}</span>
                        <span className="text-text-muted">{currencyCompact.format(point.revenue)}</span>
                      </div>
                      <div className="mt-3 h-24 flex items-end gap-2">
                        <div className="relative flex-1 h-full rounded-md bg-bg-subtle/40">
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-md bg-primary/90"
                            style={{ height: `${Math.max(point.revenue > 0 ? 8 : 0, point.revenuePct)}%` }}
                          />
                        </div>
                        <div className="relative w-3 h-full rounded-full bg-bg-subtle/40">
                          <div
                            className={[
                              "absolute left-0 right-0 bottom-0 rounded-full",
                              point.margin >= 0 ? "bg-emerald-500" : "bg-red-500"
                            ].join(" ")}
                            style={{ height: `${Math.max(point.margin !== 0 ? 8 : 0, point.marginPctOfScale)}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-text-muted">Cost {currencyCompact.format(point.cost)}</span>
                        <span className={point.margin >= 0 ? "text-emerald-700" : "text-red-600"}>
                          M {currencyCompact.format(point.margin)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: "customer", label: "Customer-wise Revenue" },
              { id: "sku", label: "SKU-wise Revenue (CP vs SP)" },
              { id: "order", label: "Order-wise Revenue" }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRevenueView(tab.id as typeof revenueView)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  revenueView === tab.id
                    ? "bg-primary text-white shadow-sm"
                    : "border border-border/60 bg-white text-text hover:bg-bg-subtle/30"
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {revenueView === "customer" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
                <div className="rounded-2xl border border-border/60 bg-white p-4">
                  <div className="text-sm font-semibold text-text">Revenue share by customer</div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="relative h-40 w-40 shrink-0">
                      <div
                        className="h-40 w-40 rounded-full"
                        style={{ background: revenueVisuals.customerShareGradient }}
                      />
                      <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                        <div className="text-[11px] uppercase tracking-wider text-text-muted">Customers</div>
                        <div className="mt-1 text-lg font-semibold text-text">
                          {data ? number.format(data.revenueBreakdown.byCustomer.length) : "0"}
                        </div>
                        <div className="text-[11px] text-text-muted">in range</div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      {revenueVisuals.customerShareSegments.length === 0 ? (
                        <div className="text-xs text-text-muted">No customer revenue to display.</div>
                      ) : (
                        revenueVisuals.customerShareSegments.map((segment) => (
                          <div key={segment.label} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: segment.color }}
                              />
                              <span className="truncate text-text">{segment.label}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-text">{currencyCompact.format(segment.value)}</div>
                              <div className="text-text-muted">{number.format(segment.pct)}%</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text">Top customers by revenue</div>
                    <div className="text-xs text-text-muted">Purple = Revenue, Green = Margin</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {revenueVisuals.topCustomerBars.length === 0 ? (
                      <div className="text-xs text-text-muted">No customer revenue data.</div>
                    ) : (
                      revenueVisuals.topCustomerBars.map((row) => (
                        <div key={row.label} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate font-medium text-text">{row.label}</span>
                            <span className="shrink-0 text-text-muted">
                              {currencyCompact.format(row.revenue)} · {number.format((row.margin / (row.revenue || 1)) * 100)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-bg-subtle/60 overflow-hidden">
                            <div className="h-full rounded-full bg-primary/90" style={{ width: `${Math.max(4, row.revenuePct)}%` }} />
                          </div>
                          <div className="h-2 rounded-full bg-bg-subtle/60 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500/90"
                              style={{ width: `${Math.max(0, row.margin >= 0 ? row.marginPctOfTopRevenue : 0)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="text-sm font-medium text-text">Customer-wise revenue and margin</div>
              <DataTable
                columns={[
                  { key: "customer", label: "Customer" },
                  { key: "invoices", label: "Invoices", align: "right" },
                  { key: "qty", label: "Qty", align: "right" },
                  { key: "revenue", label: "Revenue", align: "right" },
                  { key: "cost", label: "Final Mfg Cost", align: "right" },
                  { key: "margin", label: "Margin", align: "right" },
                  { key: "marginPct", label: "Margin %", align: "right" }
                ]}
                rows={revenueDrilldown.customerRows}
                emptyLabel={loading ? "Loading revenue breakdown..." : "No customer revenue data in this range."}
              />
            </div>
          ) : null}

          {revenueView === "sku" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 text-xs text-emerald-900">
                <div className="font-semibold">CP vs SP math used here (hard-coded)</div>
                <div className="mt-1 leading-relaxed">
                  SP/unit = Revenue ÷ Qty, CP/unit = Final Manufacturing Cost ÷ Qty, Margin = Revenue - Final Manufacturing Cost,
                  Margin/unit = Margin ÷ Qty.
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-text">SKU-wise CP vs SP (per unit)</div>
                  <div className="text-xs text-text-muted">Purple = SP/unit, Amber = CP/unit</div>
                </div>
                <div className="mt-4 space-y-3">
                  {revenueVisuals.skuUnitBars.length === 0 ? (
                    <div className="text-xs text-text-muted">No SKU revenue data.</div>
                  ) : (
                    revenueVisuals.skuUnitBars.map((row) => (
                      <div key={row.label} className="rounded-xl border border-border/50 bg-bg-subtle/10 p-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium text-text">{row.label}</span>
                          <span className={row.marginPct >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                            Margin {number.format(row.marginPct)}%
                          </span>
                        </div>
                        <div className="mt-2 space-y-2">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                              <span>SP / Unit</span>
                              <span>{currencyPrecise.format(row.spUnit)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-bg-subtle/60 overflow-hidden">
                              <div className="h-full rounded-full bg-primary/90" style={{ width: `${Math.max(4, row.spPct)}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                              <span>CP / Unit</span>
                              <span>{currencyPrecise.format(row.cpUnit)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-bg-subtle/60 overflow-hidden">
                              <div className="h-full rounded-full bg-amber-500/90" style={{ width: `${Math.max(0, row.cpPct)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "sku", label: "SKU" },
                  { key: "qty", label: "Qty", align: "right" },
                  { key: "spUnit", label: "SP/Unit", align: "right" },
                  { key: "cpUnit", label: "CP/Unit", align: "right" },
                  { key: "marginUnit", label: "Margin/Unit", align: "right" },
                  { key: "revenue", label: "Revenue", align: "right" },
                  { key: "cost", label: "Final Mfg Cost", align: "right" },
                  { key: "margin", label: "Margin", align: "right" },
                  { key: "marginPct", label: "Margin %", align: "right" }
                ]}
                rows={revenueDrilldown.skuRows}
                emptyLabel={loading ? "Loading revenue breakdown..." : "No SKU revenue data in this range."}
              />
            </div>
          ) : null}

          {revenueView === "order" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/60 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-text">Order-wise revenue and margin trend (top billed orders)</div>
                  <div className="text-xs text-text-muted">Bar length = revenue, badge = margin %</div>
                </div>
                <div className="mt-4 space-y-3">
                  {revenueVisuals.orderBars.length === 0 ? (
                    <div className="text-xs text-text-muted">No order revenue data.</div>
                  ) : (
                    revenueVisuals.orderBars.map((row) => (
                      <div key={row.label} className="grid grid-cols-[minmax(90px,120px)_1fr_auto] items-center gap-3">
                        <div className="truncate text-xs font-medium text-text">{row.label}</div>
                        <div className="relative h-8 rounded-xl bg-bg-subtle/60 overflow-hidden">
                          <div className="absolute inset-y-0 left-0 rounded-xl bg-primary/85" style={{ width: `${Math.max(5, row.revenuePct)}%` }} />
                          <div className="relative z-10 flex h-full items-center justify-between px-3 text-xs">
                            <span className="font-medium text-white mix-blend-plus-lighter">{currencyCompact.format(row.revenue)}</span>
                            <span className="text-text-muted">{currencyCompact.format(row.margin)}</span>
                          </div>
                        </div>
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[11px] font-medium",
                            row.marginPct >= 0
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border border-red-200 bg-red-50 text-red-700"
                          ].join(" ")}
                        >
                          {number.format(row.marginPct)}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="text-sm font-medium text-text">Order-wise billed revenue and contribution margin</div>
              <DataTable
                columns={[
                  { key: "order", label: "Order" },
                  { key: "customer", label: "Customer" },
                  { key: "invoices", label: "Invoices", align: "right" },
                  { key: "qty", label: "Qty", align: "right" },
                  { key: "revenue", label: "Revenue", align: "right" },
                  { key: "cost", label: "Final Mfg Cost", align: "right" },
                  { key: "margin", label: "Margin", align: "right" },
                  { key: "marginPct", label: "Margin %", align: "right" }
                ]}
                rows={revenueDrilldown.orderRows}
                emptyLabel={loading ? "Loading revenue breakdown..." : "No order revenue data in this range."}
              />
            </div>
          ) : null}
        </div>
      </Modal>

    </div>
  );
}
