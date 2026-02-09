"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { SectionHeader } from "@/components/SectionHeader";
import { apiGet } from "@/lib/api-client";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

type ReportData = {
  inventoryValue: number;
  salesByCustomer: Array<{ customerId: string; customer: string; value: number }>;
  vendorSummary: Array<{
    vendorId: string;
    vendor: string;
    totalValue: number;
    draft: number;
    pending: number;
    approved: number;
    received: number;
    cancelled: number;
  }>;
  oeeSnapshot: {
    averageOee: number;
    totalRuns: number;
    byMachine: Array<{ machine: string; avgOee: number; runs: number; materialVariancePct: number }>;
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

  useEffect(() => {
    const load = async () => {
      const response = await apiGet<ReportData>("/api/reports");
      setData(response);
    };

    load();
  }, []);

  const topCustomers = useMemo(() => data?.salesByCustomer.slice(0, 6) ?? [], [data]);
  const topVendors = useMemo(() => data?.vendorSummary.slice(0, 6) ?? [], [data]);
  const oeeByMachine = useMemo(() => data?.oeeSnapshot.byMachine.slice(0, 6) ?? [], [data]);
  const topEmployees = useMemo(() => data?.employeePerformance.summary.slice(0, 6) ?? [], [data]);
  const dailyRatings = useMemo(() => data?.employeePerformance.daily.slice(0, 10) ?? [], [data]);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Reports"
        subtitle="Inventory value, customer revenue, vendor commitments, and production efficiency."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Value</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-text">
              {data ? currency.format(data.inventoryValue) : "—"}
            </p>
            <p className="mt-2 text-sm text-text-muted">Total value across all zones.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Production OEE (7d)</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-text">
              {data ? `${number.format(data.oeeSnapshot.averageOee)}%` : "—"}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {data ? `${data.oeeSnapshot.totalRuns} runs closed` : "No logs yet"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vendor PO Value</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-semibold text-text">
              {data ? currency.format(data.vendorSummary.reduce((sum, item) => sum + item.totalValue, 0)) : "—"}
            </p>
            <p className="mt-2 text-sm text-text-muted">Across all purchase orders.</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sales by Customer</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "customer", label: "Customer" },
                { key: "value", label: "Sales", align: "right" }
              ]}
              rows={topCustomers.map((item) => ({
                customer: item.customer,
                value: currency.format(item.value)
              }))}
              emptyLabel="No sales data yet."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor PO Summary</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "vendor", label: "Vendor" },
                { key: "value", label: "Value", align: "right" },
                { key: "draft", label: "Draft", align: "right" },
                { key: "pending", label: "Pending", align: "right" },
                { key: "approved", label: "Approved", align: "right" },
                { key: "received", label: "Received", align: "right" }
              ]}
              rows={topVendors.map((item) => ({
                vendor: item.vendor,
                value: currency.format(item.totalValue),
                draft: item.draft,
                pending: item.pending,
                approved: item.approved,
                received: item.received
              }))}
              emptyLabel="No vendor PO data yet."
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Production OEE Snapshot</CardTitle>
        </CardHeader>
        <CardBody>
          <DataTable
            columns={[
              { key: "machine", label: "Machine" },
              { key: "oee", label: "Avg OEE", align: "right" },
              { key: "runs", label: "Runs", align: "right" },
              { key: "materialVar", label: "Material Var%", align: "right" }
            ]}
            rows={oeeByMachine.map((item) => ({
              machine: item.machine,
              oee: `${number.format(item.avgOee)}%`,
              runs: item.runs,
              materialVar: `${number.format(item.materialVariancePct)}%`
            }))}
            emptyLabel="No OEE data yet."
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Employee Performance (7d)</CardTitle>
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
                materialVar: `${number.format(row.materialVariancePct)}%`,
                rating: `${number.format(row.rating)}/10`
              }))}
              emptyLabel="No employee performance data yet."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Ratings (7d)</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "date", label: "Date" },
                { key: "employee", label: "Employee" },
                { key: "materialVar", label: "Material Var%", align: "right" },
                { key: "rating", label: "Rating", align: "right" },
                { key: "performance", label: "Performance", align: "right" }
              ]}
              rows={dailyRatings.map((row) => ({
                date: new Date(row.date).toLocaleDateString("en-IN"),
                employee: `${row.employeeCode} · ${row.employeeName}`,
                materialVar: `${number.format(row.materialVariancePct)}%`,
                rating: `${number.format(row.rating)}/10`,
                performance: `${number.format(row.performancePct)}%`
              }))}
              emptyLabel="No daily ratings yet."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
