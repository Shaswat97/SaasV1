"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
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

type DashboardData = {
  cards: {
    orderBacklogValue: number;
    deliveryCompletionPct: number;
    inventoryValue: number;
    avgOee: number;
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
    }>;
    delayedDeliveries: Array<{ soNumber: string; customer: string; sku: string; openQty: number; unit: string; daysOpen: number }>;
    machineDowntime: Array<{ id: string; code: string; name: string; lastRunAt: string | null }>;
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [backlog, setBacklog] = useState<BacklogLine[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dashboard, backlogData] = await Promise.all([
          apiGet<DashboardData>("/api/dashboard"),
          apiGet<BacklogLine[]>("/api/production-logs/backlog")
        ]);
        setData(dashboard);
        setBacklog(backlogData);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Order Backlog",
        value: currency.format(data.cards.orderBacklogValue),
        delta: `${number.format(data.cards.deliveryCompletionPct)}% delivered`,
        trend: "flat" as const,
        href: "/sales-orders"
      },
      {
        label: "Inventory Value",
        value: currency.format(data.cards.inventoryValue),
        delta: "Across all zones",
        trend: "flat" as const,
        href: "/inventory"
      },
      {
        label: "Avg. OEE (7d)",
        value: `${number.format(data.cards.avgOee)}%`,
        delta: "Closed logs",
        trend: "up" as const,
        href: "/production"
      },
      {
        label: "Delivery Completion",
        value: `${number.format(data.cards.deliveryCompletionPct)}%`,
        delta: "Open orders",
        trend: "flat" as const,
        href: "/sales-orders"
      }
    ];
  }, [data]);

  const alertTabs = useMemo(() => {
    if (!data) return [];
    return [
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
              { key: "shortage", label: "Shortage", align: "right" }
            ]}
            rows={data.alerts.lowStock.map((item) => ({
              sku: `${item.code} · ${item.name}`,
              type: item.skuType === "RAW" ? "Raw" : "Finished",
              onhand: `${item.onHand} ${item.unit}`,
              threshold: `${item.threshold} ${item.unit}`,
              shortage: `${item.shortage} ${item.unit}`
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
              { key: "days", label: "Days", align: "right" }
            ]}
            rows={data.alerts.delayedDeliveries.map((item) => ({
              order: item.soNumber,
              customer: item.customer,
              open: `${item.openQty} ${item.unit}`,
              days: item.daysOpen
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
              { key: "last", label: "Last Run" }
            ]}
            rows={data.alerts.machineDowntime.map((item) => ({
              machine: `${item.code} · ${item.name}`,
              last: item.lastRunAt ? new Date(item.lastRunAt).toLocaleDateString("en-IN") : "No runs"
            }))}
            emptyLabel="No downtime alerts."
          />
        )
      }
    ];
  }, [data]);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Command Center"
        subtitle="Live snapshot of demand, inventory exposure, and production health."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="block transition hover:-translate-y-0.5">
            <StatsCard label={card.label} value={card.value} delta={card.delta} trend={card.trend} />
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Production Backlog</CardTitle>
            <CardDescription>Open sales order lines awaiting production starts.</CardDescription>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "order", label: "Order" },
                { key: "customer", label: "Customer" },
                { key: "sku", label: "SKU" },
                { key: "open", label: "Open Qty", align: "right" }
              ]}
              rows={backlog.slice(0, 6).map((line) => ({
                order: line.soNumber,
                customer: line.customer,
                sku: `${line.skuCode} · ${line.skuName}`,
                open: `${line.openQty} ${line.unit}`
              }))}
              emptyLabel={loading ? "Loading backlog..." : "No production backlog."}
            />
          </CardBody>
        </Card>

        <Card variant="strong">
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardDescription>Low stock, delayed deliveries, and machine downtime.</CardDescription>
          </CardHeader>
          <CardBody>{alertTabs.length ? <Tabs items={alertTabs} /> : <p className="text-sm text-text-muted">Loading alerts...</p>}</CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Performance (Today)</CardTitle>
          <CardDescription>Rating out of 10 based on expected vs actual output.</CardDescription>
        </CardHeader>
        <CardBody>
          <DataTable
            columns={[
              { key: "employee", label: "Employee" },
              { key: "minutes", label: "Minutes", align: "right" },
              { key: "expected", label: "Expected", align: "right" },
              { key: "actual", label: "Actual", align: "right" },
              { key: "rating", label: "Rating", align: "right" }
            ]}
            rows={(data?.employeePerformance.topEmployees ?? []).map((row) => ({
              employee: `${row.employeeCode} · ${row.employeeName}`,
              minutes: number.format(row.minutes),
              expected: number.format(row.expectedUnits),
              actual: number.format(row.actualUnits),
              rating: `${number.format(row.rating)}/10`
            }))}
            emptyLabel={loading ? "Loading performance..." : "No performance data today."}
          />
        </CardBody>
      </Card>
    </div>
  );
}
