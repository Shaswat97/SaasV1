"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { SectionHeader } from "@/components/SectionHeader";
import { apiGet } from "@/lib/api-client";
import { DateFilter, getPresetRange } from "@/components/DateFilter";
import type { DateRange } from "@/components/DateFilter";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

type ReportData = {
  range: { from: string; to: string };
  overview: {
    inventoryValue: number;
    totalRevenue: number;
    totalReceivable: number;
    totalPayable: number;
    avgOee: number;
  };
  sales: {
    byCustomer: Array<{ customerId: string; customer: string; value: number; qty: number }>;
    bySku: Array<{
      skuId: string;
      code: string;
      name: string;
      unit: string;
      qty: number;
      revenue: number;
      margin: number;
      marginPct: number;
    }>;
    orderProfitability: Array<{
      salesOrderId: string;
      soNumber: string;
      customer: string;
      status: string;
      revenue: number;
      expectedCost: number;
      actualRawCost?: number;
      actualConversionCost?: number;
      actualCost: number;
      margin: number;
      marginPct: number;
    }>;
    orderLineProfitability: Array<{
      salesOrderId: string;
      soLineId: string;
      soNumber: string;
      customer: string;
      orderStatus: string;
      skuId: string;
      skuCode: string;
      skuName: string;
      unit: string;
      qty: number;
      revenueExTax: number;
      revenueIncTax: number;
      rawCost: number;
      laborCost: number;
      overheadCost: number;
      finalMfgCost: number;
      spPerUnit: number;
      cpPerUnit: number;
      margin: number;
      marginPct: number;
    }>;
  };
  production: {
    summary: { planned: number; good: number; reject: number; scrap: number; yieldPct: number };
    byMachine: Array<{
      machineId: string;
      machine: string;
      runtimeMinutes: number;
      plannedQty: number;
      goodQty: number;
      rejectQty: number;
      scrapQty: number;
      utilizationPct: number;
      avgOee: number;
      yieldPct: number;
      materialVariancePct: number;
      runs: number;
    }>;
    bySku: Array<{
      skuId: string;
      code: string;
      name: string;
      planned: number;
      good: number;
      reject: number;
      scrap: number;
      yieldPct: number;
    }>;
  };
  inventory: {
    bySku: Array<{
      skuId: string;
      code: string;
      name: string;
      skuType: string;
      onHand: number;
      value: number;
      lastMovementAt: string | null;
      daysSinceMovement: number | null;
    }>;
    aging: Array<{ bucket: string; value: number }>;
  };
  procurement: {
    vendorSummary: Array<{
      vendorId: string;
      vendor: string;
      totalValue: number;
      draft: number;
      pending: number;
      approved: number;
      received: number;
      cancelled: number;
      onTimePct: number;
    }>;
  };
  finance: {
    receivablesAging: Array<{ bucket: string; amount: number }>;
    payablesAging: Array<{ bucket: string; amount: number }>;
    collectionsInRange: number;
    vendorPaymentsInRange: number;
  };
  employeePerformance: {
    summary: Array<{
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
    }>;
    daily: Array<{
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      date: string;
      minutes: number;
      expectedUnits: number;
      actualUnits: number;
      performancePct: number;
      expectedRawCost: number;
      actualRawCost: number;
      materialVariancePct: number;
      rating: number;
    }>;
  };
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange("current_month"));
  const fromDate = dateRange.from.toISOString().slice(0, 10);
  const toDate = dateRange.to.toISOString().slice(0, 10);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const query = `?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
        const response = await apiGet<ReportData>(`/api/reports${query}`);
        setData(response);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fromDate, toDate]);

  const topCustomers = useMemo(() => data?.sales.byCustomer.slice(0, 10) ?? [], [data]);
  const topSkuSales = useMemo(() => data?.sales.bySku.slice(0, 12) ?? [], [data]);
  const orderProfitability = useMemo(() => data?.sales.orderProfitability.slice(0, 12) ?? [], [data]);
  const orderLineProfitability = useMemo(() => data?.sales.orderLineProfitability.slice(0, 20) ?? [], [data]);
  const machineEfficiency = useMemo(() => data?.production.byMachine.slice(0, 12) ?? [], [data]);
  const productionBySku = useMemo(() => data?.production.bySku.slice(0, 12) ?? [], [data]);
  const inventoryBySku = useMemo(() => data?.inventory.bySku.slice(0, 12) ?? [], [data]);
  const vendorSummary = useMemo(() => data?.procurement.vendorSummary.slice(0, 10) ?? [], [data]);
  const topEmployees = useMemo(() => data?.employeePerformance.summary.slice(0, 12) ?? [], [data]);
  const dailyRatings = useMemo(() => data?.employeePerformance.daily.slice(0, 12) ?? [], [data]);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Reports"
        subtitle="Sales, production, inventory, procurement and finance performance."
        actions={
          <div className="flex items-center gap-3">
            <DateFilter
              value={dateRange}
              onChange={(range) => setDateRange(range)}
              defaultPreset="current_month"
            />
            <Link
              href="/reports/documents"
              className="inline-flex items-center rounded-full bg-surface-2/80 px-4 py-2 text-sm font-medium text-text hover:bg-surface-2"
            >
              Documents Archive
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border/60 bg-white p-5 flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Total Revenue</span>
          <p className="text-2xl font-bold text-green-600">{data ? currency.format(data.overview.totalRevenue) : "—"}</p>
          <div className="h-1 w-12 rounded-full bg-green-200 mt-1" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-5 flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Inventory Value</span>
          <p className="text-2xl font-bold text-blue-600">{data ? currency.format(data.overview.inventoryValue) : "—"}</p>
          <div className="h-1 w-12 rounded-full bg-blue-200 mt-1" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-5 flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Receivables</span>
          <p className="text-2xl font-bold text-orange-600">{data ? currency.format(data.overview.totalReceivable) : "—"}</p>
          <div className="h-1 w-12 rounded-full bg-orange-200 mt-1" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-5 flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Payables</span>
          <p className="text-2xl font-bold text-red-600">{data ? currency.format(data.overview.totalPayable) : "—"}</p>
          <div className="h-1 w-12 rounded-full bg-red-200 mt-1" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-white p-5 flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Avg OEE</span>
          <p className={`text-2xl font-bold ${(data?.overview.avgOee ?? 0) >= 75 ? "text-green-600" : (data?.overview.avgOee ?? 0) >= 50 ? "text-yellow-600" : "text-red-600"}`}>{data ? `${number.format(data.overview.avgOee)}%` : "—"}</p>
          <div className="h-1 w-12 rounded-full bg-accent/30 mt-1" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">Sales by Customer</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">{topCustomers.length}</span>
            </div>
          </div>
          <CardBody className="pt-3">
            <div className="max-h-[400px] overflow-y-auto">
              <DataTable
                columns={[
                  { key: "customer", label: "Customer" },
                  { key: "qty", label: "Qty", align: "right" as const },
                  { key: "value", label: "Revenue", align: "right" as const }
                ]}
                rows={topCustomers.map((item, idx) => ({
                  customer: (
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ${idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-orange-400" : "bg-gray-200 text-gray-600"
                        }`}>{idx + 1}</span>
                      <span className="font-medium">{item.customer}</span>
                    </div>
                  ),
                  qty: <span className="font-medium">{number.format(item.qty)}</span>,
                  value: <span className="font-semibold text-green-600">{currency.format(item.value)}</span>
                }))}
                emptyLabel={loading ? "Loading..." : "No customer sales data."}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <div className="px-6 pt-5 pb-0">
            <span className="text-sm font-semibold text-text">Receivables vs Payables</span>
          </div>
          <CardBody className="pt-3">
            <DataTable
              columns={[
                { key: "metric", label: "Metric" },
                { key: "value", label: "Value", align: "right" as const }
              ]}
              rows={[
                { metric: <span className="font-medium">Collections in range</span>, value: <span className="font-semibold text-green-600">{currency.format(data?.finance.collectionsInRange ?? 0)}</span> },
                { metric: <span className="font-medium">Vendor payments in range</span>, value: <span className="font-semibold text-red-600">{currency.format(data?.finance.vendorPaymentsInRange ?? 0)}</span> }
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">Best Performing SKUs</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">{topSkuSales.length}</span>
          </div>
          <p className="text-xs text-text-muted mt-1">Revenue and contribution margin by SKU.</p>
        </div>
        <CardBody className="pt-3">
          <div className="max-h-[500px] overflow-y-auto">
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "qty", label: "Qty", align: "right" as const },
                { key: "revenue", label: "Revenue", align: "right" as const },
                { key: "margin", label: "Margin", align: "right" as const }
              ]}
              rows={topSkuSales.map((item) => ({
                sku: (
                  <span className="text-sm">
                    <span className="font-semibold text-accent">{item.code}</span>
                    <span className="text-text-muted"> · {item.name}</span>
                  </span>
                ),
                qty: <span className="font-medium">{number.format(item.qty)} {item.unit}</span>,
                revenue: <span className="font-semibold text-green-600">{currency.format(item.revenue)}</span>,
                margin: (
                  <span className={`font-medium ${item.marginPct >= 20 ? "text-green-600" : item.marginPct >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                    {currency.format(item.margin)} ({number.format(item.marginPct)}%)
                  </span>
                )
              }))}
              emptyLabel={loading ? "Loading..." : "No SKU sales data."}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">Order Line Costing (SKU-wise)</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">{orderLineProfitability.length}</span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Hard-coded formula: Final Mfg Cost = Raw Cost + Labor Cost + Machine Overhead. Margin = Net Revenue (excl tax) - Final Mfg Cost.
          </p>
          <p className="text-xs text-text-muted mt-1">
            SP/unit = Net Revenue ÷ Qty, CP/unit = Final Mfg Cost ÷ Qty. Costs are allocated to invoice qty from the linked sales-order line.
          </p>
        </div>
        <CardBody className="pt-3">
          <div className="max-h-[560px] overflow-y-auto">
            <DataTable
              columns={[
                { key: "order", label: "Order" },
                { key: "sku", label: "SKU" },
                { key: "qty", label: "Qty", align: "right" as const },
                { key: "spUnit", label: "SP/Unit", align: "right" as const },
                { key: "revenue", label: "Net Revenue", align: "right" as const },
                { key: "raw", label: "Raw Cost", align: "right" as const },
                { key: "labor", label: "Labor", align: "right" as const },
                { key: "overhead", label: "Overhead", align: "right" as const },
                { key: "finalCost", label: "Final Mfg Cost", align: "right" as const },
                { key: "cpUnit", label: "CP/Unit", align: "right" as const },
                { key: "margin", label: "Margin", align: "right" as const }
              ]}
              rows={orderLineProfitability.map((item) => ({
                order: (
                  <div className="flex flex-col">
                    <span className="font-semibold text-accent">{item.soNumber}</span>
                    <span className="text-xs text-text-muted">{item.customer}</span>
                  </div>
                ),
                sku: (
                  <div className="flex flex-col">
                    <span className="font-medium text-text">{item.skuCode} · {item.skuName}</span>
                    <span className="text-xs text-text-muted">{item.orderStatus}</span>
                  </div>
                ),
                qty: <span className="font-medium">{number.format(item.qty)} {item.unit}</span>,
                spUnit: <span className="font-medium">{currency.format(item.spPerUnit)}</span>,
                revenue: <span className="font-semibold text-green-600">{currency.format(item.revenueExTax)}</span>,
                raw: <span>{currency.format(item.rawCost)}</span>,
                labor: <span>{currency.format(item.laborCost)}</span>,
                overhead: <span>{currency.format(item.overheadCost)}</span>,
                finalCost: <span className="font-medium text-red-600">{currency.format(item.finalMfgCost)}</span>,
                cpUnit: <span className="font-medium">{currency.format(item.cpPerUnit)}</span>,
                margin: (
                  <span className={`font-semibold ${item.marginPct >= 20 ? "text-green-600" : item.marginPct >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                    {currency.format(item.margin)} ({number.format(item.marginPct)}%)
                  </span>
                )
              }))}
              emptyLabel={loading ? "Loading..." : "No order line costing data."}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">Order Profitability</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">{orderProfitability.length}</span>
          </div>
          <p className="text-xs text-text-muted mt-1">Sales order level margin after contribution cost (raw + labor + machine overhead).</p>
        </div>
        <CardBody className="pt-3">
          <div className="max-h-[500px] overflow-y-auto">
            <DataTable
              columns={[
                { key: "so", label: "Order" },
                { key: "customer", label: "Customer" },
                { key: "status", label: "Status" },
                { key: "revenue", label: "Revenue", align: "right" as const },
                { key: "cost", label: "Contribution Cost", align: "right" as const },
                { key: "margin", label: "Margin", align: "right" as const }
              ]}
              rows={orderProfitability.map((item) => ({
                so: <span className="font-semibold text-accent">{item.soNumber}</span>,
                customer: item.customer,
                status: (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === "DELIVERED" ? "bg-green-50 text-green-700 border border-green-200" :
                    item.status === "PRODUCTION" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                      item.status === "CONFIRMED" ? "bg-yellow-50 text-yellow-700 border border-yellow-200" :
                        item.status === "INVOICED" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                          "bg-gray-100 text-gray-700 border border-gray-200"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.status === "DELIVERED" ? "bg-green-500" :
                      item.status === "PRODUCTION" ? "bg-blue-500" :
                        item.status === "CONFIRMED" ? "bg-yellow-500" :
                          item.status === "INVOICED" ? "bg-purple-500" :
                            "bg-gray-500"
                      }`} />
                    {item.status}
                  </span>
                ),
                revenue: <span className="font-semibold text-green-600">{currency.format(item.revenue)}</span>,
                cost: <span className="font-medium text-red-600">{currency.format(item.actualCost > 0 ? item.actualCost : item.expectedCost)}</span>,
                margin: (
                  <span className={`font-semibold ${item.marginPct >= 20 ? "text-green-600" : item.marginPct >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                    {currency.format(item.margin)} ({number.format(item.marginPct)}%)
                  </span>
                )
              }))}
              emptyLabel={loading ? "Loading..." : "No order profitability data."}
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">Machine Efficiency</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{machineEfficiency.length}</span>
            </div>
          </div>
          <CardBody className="pt-3">
            <div className="max-h-[400px] overflow-y-auto">
              <DataTable
                columns={[
                  { key: "machine", label: "Machine" },
                  { key: "util", label: "Util%", align: "right" as const },
                  { key: "oee", label: "OEE%", align: "right" as const },
                  { key: "yield", label: "Yield%", align: "right" as const },
                  { key: "variance", label: "Material Var%", align: "right" as const }
                ]}
                rows={machineEfficiency.map((row) => ({
                  machine: <span className="font-medium">{row.machine}</span>,
                  util: (
                    <span className={`font-medium ${row.utilizationPct >= 80 ? "text-green-600" : row.utilizationPct >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                      {number.format(row.utilizationPct)}%
                    </span>
                  ),
                  oee: (
                    <span className={`font-semibold ${row.avgOee >= 75 ? "text-green-600" : row.avgOee >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                      {number.format(row.avgOee)}%
                    </span>
                  ),
                  yield: (
                    <span className={`font-medium ${row.yieldPct >= 95 ? "text-green-600" : row.yieldPct >= 85 ? "text-yellow-600" : "text-red-600"}`}>
                      {number.format(row.yieldPct)}%
                    </span>
                  ),
                  variance: (
                    <span className={`font-medium ${row.materialVariancePct > 5 ? "text-red-600" : row.materialVariancePct < -5 ? "text-green-600" : "text-text-muted"}`}>
                      {number.format(row.materialVariancePct)}%
                    </span>
                  )
                }))}
                emptyLabel={loading ? "Loading..." : "No machine data."}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <div className="px-6 pt-5 pb-0">
            <span className="text-sm font-semibold text-text">Production Yield by SKU</span>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
              <span>Planned: <span className="font-medium text-text">{number.format(data?.production.summary.planned ?? 0)}</span></span>
              <span>Good: <span className="font-medium text-green-600">{number.format(data?.production.summary.good ?? 0)}</span></span>
              <span>Yield: <span className={`font-medium ${(data?.production.summary.yieldPct ?? 0) >= 95 ? "text-green-600" : "text-yellow-600"}`}>{number.format(data?.production.summary.yieldPct ?? 0)}%</span></span>
            </div>
          </div>
          <CardBody className="pt-3">
            <div className="max-h-[400px] overflow-y-auto">
              <DataTable
                columns={[
                  { key: "sku", label: "SKU" },
                  { key: "good", label: "Good", align: "right" as const },
                  { key: "reject", label: "Reject", align: "right" as const },
                  { key: "scrap", label: "Scrap", align: "right" as const },
                  { key: "yield", label: "Yield%", align: "right" as const }
                ]}
                rows={productionBySku.map((row) => ({
                  sku: (
                    <span className="text-sm">
                      <span className="font-semibold text-accent">{row.code}</span>
                      <span className="text-text-muted"> · {row.name}</span>
                    </span>
                  ),
                  good: <span className="font-medium text-green-600">{number.format(row.good)}</span>,
                  reject: <span className={`font-medium ${row.reject > 0 ? "text-red-600" : "text-text-muted"}`}>{number.format(row.reject)}</span>,
                  scrap: <span className={`font-medium ${row.scrap > 0 ? "text-orange-600" : "text-text-muted"}`}>{number.format(row.scrap)}</span>,
                  yield: (
                    <span className={`font-semibold ${row.yieldPct >= 95 ? "text-green-600" : row.yieldPct >= 85 ? "text-yellow-600" : "text-red-600"}`}>
                      {number.format(row.yieldPct)}%
                    </span>
                  )
                }))}
                emptyLabel={loading ? "Loading..." : "No production by SKU data."}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="px-6 pt-5 pb-0">
            <span className="text-sm font-semibold text-text">Inventory Aging & Slow Moving</span>
          </div>
          <CardBody className="pt-3">
            <div className="max-h-[400px] overflow-y-auto">
              <DataTable
                columns={[
                  { key: "sku", label: "SKU" },
                  { key: "type", label: "Type" },
                  { key: "onHand", label: "On Hand", align: "right" as const },
                  { key: "value", label: "Value", align: "right" as const },
                  { key: "idle", label: "Days Idle", align: "right" as const }
                ]}
                rows={inventoryBySku.map((row) => ({
                  sku: (
                    <span className="text-sm">
                      <span className="font-semibold text-accent">{row.code}</span>
                      <span className="text-text-muted"> · {row.name}</span>
                    </span>
                  ),
                  type: (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.skuType === "FINISHED" ? "bg-green-50 text-green-700 border border-green-200" :
                        row.skuType === "RAW" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}>{row.skuType}</span>
                  ),
                  onHand: <span className="font-medium">{number.format(row.onHand)}</span>,
                  value: <span className="font-medium text-blue-600">{currency.format(row.value)}</span>,
                  idle: row.daysSinceMovement == null ? <span className="text-gray-300">—</span> : (
                    <span className={`font-medium ${row.daysSinceMovement > 90 ? "text-red-600" : row.daysSinceMovement > 30 ? "text-orange-600" : "text-green-600"}`}>
                      {row.daysSinceMovement}d
                    </span>
                  )
                }))}
                emptyLabel={loading ? "Loading..." : "No inventory data."}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <div className="px-6 pt-5 pb-0">
            <span className="text-sm font-semibold text-text">Inventory Value Aging Buckets</span>
          </div>
          <CardBody className="pt-3">
            <DataTable
              columns={[
                { key: "bucket", label: "Bucket (days)" },
                { key: "value", label: "Value", align: "right" as const }
              ]}
              rows={(data?.inventory.aging ?? []).map((row, idx) => ({
                bucket: <span className="font-medium">{row.bucket}</span>,
                value: (
                  <span className={`font-semibold ${idx === 0 ? "text-green-600" : idx <= 1 ? "text-yellow-600" : idx <= 2 ? "text-orange-600" : "text-red-600"}`}>
                    {currency.format(row.value)}
                  </span>
                )
              }))}
              emptyLabel={loading ? "Loading..." : "No aging data."}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">Vendor Performance</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">{vendorSummary.length}</span>
            </div>
          </div>
          <CardBody className="pt-3">
            <div className="max-h-[400px] overflow-y-auto">
              <DataTable
                columns={[
                  { key: "vendor", label: "Vendor" },
                  { key: "value", label: "PO Value", align: "right" as const },
                  { key: "received", label: "Received", align: "right" as const },
                  { key: "pending", label: "Pending", align: "right" as const },
                  { key: "onTime", label: "On-time %", align: "right" as const }
                ]}
                rows={vendorSummary.map((row) => ({
                  vendor: <span className="font-medium">{row.vendor}</span>,
                  value: <span className="font-semibold text-blue-600">{currency.format(row.totalValue)}</span>,
                  received: <span className="font-medium text-green-600">{row.received}</span>,
                  pending: <span className={`font-medium ${row.pending > 0 ? "text-orange-600" : "text-green-600"}`}>{row.pending}</span>,
                  onTime: (
                    <span className={`font-semibold ${row.onTimePct >= 90 ? "text-green-600" : row.onTimePct >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                      {number.format(row.onTimePct)}%
                    </span>
                  )
                }))}
                emptyLabel={loading ? "Loading..." : "No procurement data."}
              />
            </div>
          </CardBody>
        </Card>
        <Card>
          <div className="px-6 pt-5 pb-0">
            <span className="text-sm font-semibold text-text">Receivable/Payable Aging</span>
          </div>
          <CardBody className="pt-3">
            <DataTable
              columns={[
                { key: "bucket", label: "Bucket" },
                { key: "recv", label: "Receivable", align: "right" as const },
                { key: "pay", label: "Payable", align: "right" as const }
              ]}
              rows={(data?.finance.receivablesAging ?? []).map((row, idx) => ({
                bucket: <span className="font-medium">{row.bucket}</span>,
                recv: <span className="font-semibold text-green-600">{currency.format(row.amount)}</span>,
                pay: <span className="font-semibold text-red-600">{currency.format(data?.finance.payablesAging[idx]?.amount ?? 0)}</span>
              }))}
              emptyLabel={loading ? "Loading..." : "No finance aging data."}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">Employee Performance</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">{topEmployees.length}</span>
            </div>
          </div>
          <CardBody className="pt-3">
            <div className="max-h-[400px] overflow-y-auto">
              <DataTable
                columns={[
                  { key: "employee", label: "Employee" },
                  { key: "minutes", label: "Minutes", align: "right" as const },
                  { key: "expected", label: "Expected", align: "right" as const },
                  { key: "actual", label: "Actual", align: "right" as const },
                  { key: "materialVar", label: "Mat Var%", align: "right" as const },
                  { key: "rating", label: "Rating", align: "right" as const }
                ]}
                rows={topEmployees.map((row) => ({
                  employee: (
                    <span className="text-sm">
                      <span className="font-semibold text-accent">{row.employeeCode}</span>
                      <span className="text-text-muted"> · {row.employeeName}</span>
                    </span>
                  ),
                  minutes: <span className="font-medium">{number.format(row.minutes)}</span>,
                  expected: <span className="font-medium text-text-muted">{number.format(row.expectedUnits)}</span>,
                  actual: (
                    <span className={`font-medium ${row.actualUnits >= row.expectedUnits ? "text-green-600" : "text-red-600"}`}>
                      {number.format(row.actualUnits)}
                    </span>
                  ),
                  materialVar: (
                    <span className={`font-medium ${row.materialVariancePct > 5 ? "text-red-600" : row.materialVariancePct < -5 ? "text-green-600" : "text-text-muted"}`}>
                      {number.format(row.materialVariancePct)}%
                    </span>
                  ),
                  rating: (
                    <span className={`inline-flex items-center gap-1 font-semibold ${row.rating >= 8 ? "text-green-600" : row.rating >= 5 ? "text-yellow-600" : "text-red-600"}`}>
                      {number.format(row.rating)}/10
                    </span>
                  )
                }))}
                emptyLabel={loading ? "Loading..." : "No employee performance data."}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">Employee Daily Ratings</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">{dailyRatings.length}</span>
            </div>
          </div>
          <CardBody className="pt-3">
            <div className="max-h-[400px] overflow-y-auto">
              <DataTable
                columns={[
                  { key: "date", label: "Date" },
                  { key: "employee", label: "Employee" },
                  { key: "performance", label: "Performance%", align: "right" as const },
                  { key: "materialVar", label: "Mat Var%", align: "right" as const },
                  { key: "rating", label: "Rating", align: "right" as const }
                ]}
                rows={dailyRatings.map((row) => ({
                  date: <span className="font-medium">{new Date(row.date).toLocaleDateString("en-IN")}</span>,
                  employee: (
                    <span className="text-sm">
                      <span className="font-semibold text-accent">{row.employeeCode}</span>
                      <span className="text-text-muted"> · {row.employeeName}</span>
                    </span>
                  ),
                  performance: (
                    <span className={`font-medium ${row.performancePct >= 100 ? "text-green-600" : row.performancePct >= 80 ? "text-yellow-600" : "text-red-600"}`}>
                      {number.format(row.performancePct)}%
                    </span>
                  ),
                  materialVar: (
                    <span className={`font-medium ${row.materialVariancePct > 5 ? "text-red-600" : row.materialVariancePct < -5 ? "text-green-600" : "text-text-muted"}`}>
                      {number.format(row.materialVariancePct)}%
                    </span>
                  ),
                  rating: (
                    <span className={`font-semibold ${row.rating >= 8 ? "text-green-600" : row.rating >= 5 ? "text-yellow-600" : "text-red-600"}`}>
                      {number.format(row.rating)}/10
                    </span>
                  )
                }))}
                emptyLabel={loading ? "Loading..." : "No daily ratings data."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
