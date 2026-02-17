"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { apiGet } from "@/lib/api-client";

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
      actualCost: number;
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
  const [fromDate, setFromDate] = useState(() => {
    const base = new Date();
    base.setDate(base.getDate() - 29);
    return base.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

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
          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <Link
              href="/reports/documents"
              className="inline-flex items-center rounded-full bg-surface-2/80 px-4 py-2 text-sm font-medium text-text hover:bg-surface-2"
            >
              Open Documents Archive
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-text">{data ? currency.format(data.overview.totalRevenue) : "—"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inventory Value</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-text">{data ? currency.format(data.overview.inventoryValue) : "—"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receivables</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-text">{data ? currency.format(data.overview.totalReceivable) : "—"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payables</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-text">{data ? currency.format(data.overview.totalPayable) : "—"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Avg OEE</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-text">{data ? `${number.format(data.overview.avgOee)}%` : "—"}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sales by Customer</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "customer", label: "Customer" },
                { key: "qty", label: "Qty", align: "right" },
                { key: "value", label: "Revenue", align: "right" }
              ]}
              rows={topCustomers.map((item) => ({
                customer: item.customer,
                qty: number.format(item.qty),
                value: currency.format(item.value)
              }))}
              emptyLabel={loading ? "Loading..." : "No customer sales data."}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receivables vs Payables (Range)</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "metric", label: "Metric" },
                { key: "value", label: "Value", align: "right" }
              ]}
              rows={[
                { metric: "Collections in range", value: currency.format(data?.finance.collectionsInRange ?? 0) },
                { metric: "Vendor payments in range", value: currency.format(data?.finance.vendorPaymentsInRange ?? 0) }
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Best Performing SKUs</CardTitle>
          <CardDescription>Revenue and contribution margin by SKU.</CardDescription>
        </CardHeader>
        <CardBody>
          <DataTable
            columns={[
              { key: "sku", label: "SKU" },
              { key: "qty", label: "Qty", align: "right" },
              { key: "revenue", label: "Revenue", align: "right" },
              { key: "margin", label: "Margin", align: "right" }
            ]}
            rows={topSkuSales.map((item) => ({
              sku: `${item.code} · ${item.name}`,
              qty: `${number.format(item.qty)} ${item.unit}`,
              revenue: currency.format(item.revenue),
              margin: `${currency.format(item.margin)} (${number.format(item.marginPct)}%)`
            }))}
            emptyLabel={loading ? "Loading..." : "No SKU sales data."}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Profitability</CardTitle>
          <CardDescription>Sales order level margin after expected/actual raw cost.</CardDescription>
        </CardHeader>
        <CardBody>
          <DataTable
            columns={[
              { key: "so", label: "Order" },
              { key: "customer", label: "Customer" },
              { key: "status", label: "Status" },
              { key: "revenue", label: "Revenue", align: "right" },
              { key: "cost", label: "Cost Used", align: "right" },
              { key: "margin", label: "Margin", align: "right" }
            ]}
            rows={orderProfitability.map((item) => ({
              so: item.soNumber,
              customer: item.customer,
              status: item.status,
              revenue: currency.format(item.revenue),
              cost: currency.format(item.actualCost > 0 ? item.actualCost : item.expectedCost),
              margin: `${currency.format(item.margin)} (${number.format(item.marginPct)}%)`
            }))}
            emptyLabel={loading ? "Loading..." : "No order profitability data."}
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Machine Efficiency</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "machine", label: "Machine" },
                { key: "util", label: "Util%", align: "right" },
                { key: "oee", label: "OEE%", align: "right" },
                { key: "yield", label: "Yield%", align: "right" },
                { key: "variance", label: "Material Var%", align: "right" }
              ]}
              rows={machineEfficiency.map((row) => ({
                machine: row.machine,
                util: number.format(row.utilizationPct),
                oee: number.format(row.avgOee),
                yield: number.format(row.yieldPct),
                variance: number.format(row.materialVariancePct)
              }))}
              emptyLabel={loading ? "Loading..." : "No machine data."}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Production Yield by SKU</CardTitle>
            <CardDescription>
              Planned: {number.format(data?.production.summary.planned ?? 0)} · Good:{" "}
              {number.format(data?.production.summary.good ?? 0)} · Yield:{" "}
              {number.format(data?.production.summary.yieldPct ?? 0)}%
            </CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "good", label: "Good", align: "right" },
                { key: "reject", label: "Reject", align: "right" },
                { key: "scrap", label: "Scrap", align: "right" },
                { key: "yield", label: "Yield%", align: "right" }
              ]}
              rows={productionBySku.map((row) => ({
                sku: `${row.code} · ${row.name}`,
                good: number.format(row.good),
                reject: number.format(row.reject),
                scrap: number.format(row.scrap),
                yield: number.format(row.yieldPct)
              }))}
              emptyLabel={loading ? "Loading..." : "No production by SKU data."}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Aging & Slow Moving</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "sku", label: "SKU" },
                { key: "type", label: "Type" },
                { key: "onHand", label: "On Hand", align: "right" },
                { key: "value", label: "Value", align: "right" },
                { key: "idle", label: "Days Since Movement", align: "right" }
              ]}
              rows={inventoryBySku.map((row) => ({
                sku: `${row.code} · ${row.name}`,
                type: row.skuType,
                onHand: number.format(row.onHand),
                value: currency.format(row.value),
                idle: row.daysSinceMovement == null ? "—" : row.daysSinceMovement
              }))}
              emptyLabel={loading ? "Loading..." : "No inventory data."}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inventory Value Aging Buckets</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "bucket", label: "Bucket (days)" },
                { key: "value", label: "Value", align: "right" }
              ]}
              rows={(data?.inventory.aging ?? []).map((row) => ({
                bucket: row.bucket,
                value: currency.format(row.value)
              }))}
              emptyLabel={loading ? "Loading..." : "No aging data."}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Procurement Vendor Performance</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "vendor", label: "Vendor" },
                { key: "value", label: "PO Value", align: "right" },
                { key: "received", label: "Received", align: "right" },
                { key: "pending", label: "Pending", align: "right" },
                { key: "onTime", label: "On-time %", align: "right" }
              ]}
              rows={vendorSummary.map((row) => ({
                vendor: row.vendor,
                value: currency.format(row.totalValue),
                received: row.received,
                pending: row.pending,
                onTime: `${number.format(row.onTimePct)}%`
              }))}
              emptyLabel={loading ? "Loading..." : "No procurement data."}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receivable/Payable Aging</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "bucket", label: "Bucket" },
                { key: "recv", label: "Receivable", align: "right" },
                { key: "pay", label: "Payable", align: "right" }
              ]}
              rows={(data?.finance.receivablesAging ?? []).map((row, idx) => ({
                bucket: row.bucket,
                recv: currency.format(row.amount),
                pay: currency.format(data?.finance.payablesAging[idx]?.amount ?? 0)
              }))}
              emptyLabel={loading ? "Loading..." : "No finance aging data."}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Employee Performance</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "employee", label: "Employee" },
                { key: "minutes", label: "Minutes", align: "right" },
                { key: "expected", label: "Expected", align: "right" },
                { key: "actual", label: "Actual", align: "right" },
                { key: "materialVar", label: "Material Var%", align: "right" },
                { key: "rating", label: "Rating", align: "right" }
              ]}
              rows={topEmployees.map((row) => ({
                employee: `${row.employeeCode} · ${row.employeeName}`,
                minutes: number.format(row.minutes),
                expected: number.format(row.expectedUnits),
                actual: number.format(row.actualUnits),
                materialVar: number.format(row.materialVariancePct),
                rating: `${number.format(row.rating)}/10`
              }))}
              emptyLabel={loading ? "Loading..." : "No employee performance data."}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee Daily Ratings</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "date", label: "Date" },
                { key: "employee", label: "Employee" },
                { key: "performance", label: "Performance%", align: "right" },
                { key: "materialVar", label: "Material Var%", align: "right" },
                { key: "rating", label: "Rating", align: "right" }
              ]}
              rows={dailyRatings.map((row) => ({
                date: new Date(row.date).toLocaleDateString("en-IN"),
                employee: `${row.employeeCode} · ${row.employeeName}`,
                performance: number.format(row.performancePct),
                materialVar: number.format(row.materialVariancePct),
                rating: `${number.format(row.rating)}/10`
              }))}
              emptyLabel={loading ? "Loading..." : "No daily ratings data."}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
