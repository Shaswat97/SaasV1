"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { apiGet } from "@/lib/api-client";
import { DateFilter, getPresetRange } from "@/components/DateFilter";
import type { DateRange } from "@/components/DateFilter";

const entityOptions = [
  "ALL",
  "Company",
  "Vendor",
  "Customer",
  "Employee",
  "Role",
  "Raw SKU",
  "Finished SKU",
  "Machine",
  "Machine SKU",
  "BOM",
  "Warehouse",
  "Zone",
  "Sales Order",
  "Purchase Order",
  "Production Log",
  "Inventory",
  "Delivery",
  "Invoice"
].map((value) => ({ value, label: value === "ALL" ? "All Entities" : value }));

const actionOptions = [
  { value: "ALL", label: "All Actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" }
];

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function formatTimestamp(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function formatTimestampCsv(value: string) {
  return new Date(value).toISOString();
}

function escapeCsv(value: string) {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

type ActivityLog = {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  createdAt: string;
};

export default function ActivityPage() {
  const toLocalDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange("7d"));
  const from = toLocalDate(dateRange.from);
  const to = toLocalDate(dateRange.to);
  const [entity, setEntity] = useState("ALL");
  const [action, setAction] = useState("ALL");
  const [actor, setActor] = useState("ALL");
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (entity) params.set("entity", entity);
        if (action) params.set("action", action);
        if (actor) params.set("actor", actor);
        if (search) params.set("search", search.trim());
        const data = await apiGet<ActivityLog[]>(`/api/activity?${params.toString()}`);
        setLogs(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [from, to, entity, action, actor, search, dateRange]);

  const actorOptions = useMemo(() => {
    const names = Array.from(new Set(logs.map((log) => log.actorName))).filter(Boolean).sort();
    return [{ value: "ALL", label: "All Users" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [logs]);

  function exportCsv() {
    if (!logs.length) return;
    const header = ["Time", "User", "Action", "Entity", "Summary"];
    const rows = logs.map((log) => [
      formatTimestampCsv(log.createdAt),
      log.actorName,
      log.action,
      log.entityType,
      log.summary
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const rows = logs
      .map(
        (log) => `
        <tr>
          <td>${formatTimestamp(log.createdAt)}</td>
          <td>${log.actorName}</td>
          <td>${log.action}</td>
          <td>${log.entityType}</td>
          <td>${log.summary}</td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Activity Log</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
            h1 { margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f3f3f3; }
          </style>
        </head>
        <body>
          <h1>Activity Log</h1>
          <p>Period: ${from} to ${to}</p>
          <table>
            <thead>
              <tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Summary</th></tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="5">No records</td></tr>`}</tbody>
          </table>
        </body>
      </html>
    `;
    const printWindow = window.open("", "_blank", "width=960,height=720");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Activity"
        subtitle="Every create, update, and delete across the system with who did it and when."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!logs.length}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={exportPdf} disabled={!logs.length}>
              Export PDF
            </Button>
          </>
        }
      />

      <Card>
        <div className="px-6 pt-5 pb-0 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1">
              {[
                { key: "ALL", label: "All", count: logs.length },
                { key: "CREATE", label: "Create", count: logs.filter(l => l.action === "CREATE").length },
                { key: "UPDATE", label: "Update", count: logs.filter(l => l.action === "UPDATE").length },
                { key: "DELETE", label: "Delete", count: logs.filter(l => l.action === "DELETE").length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAction(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${action === tab.key
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:bg-gray-100"
                    }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search activity..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-3 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-56"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">Date Range</label>
              <DateFilter
                value={dateRange}
                onChange={(range) => setDateRange(range)}
                defaultPreset="7d"
              />
            </div>
            <Select label="Entity" value={entity} onChange={(event) => setEntity(event.target.value)} options={entityOptions} />
            <Select label="User" value={actor} onChange={(event) => setActor(event.target.value)} options={actorOptions} />
          </div>
        </div>
        <CardBody className="pt-3">
          <div className="max-h-[600px] overflow-y-auto">
            <DataTable
              columns={[
                { key: "time", label: "Time" },
                { key: "user", label: "User" },
                { key: "action", label: "Action" },
                { key: "entity", label: "Entity" },
                { key: "summary", label: "Summary" }
              ]}
              rows={logs.map((log) => {
                const actionColors: Record<string, { bg: string; text: string; dot: string }> = {
                  CREATE: { bg: "bg-green-50 border-green-200", text: "text-green-700", dot: "bg-green-500" },
                  UPDATE: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
                  DELETE: { bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-500" },
                };
                const entityColors: Record<string, string> = {
                  SalesOrder: "bg-yellow-50 text-yellow-700 border-yellow-200",
                  PurchaseOrder: "bg-purple-50 text-purple-700 border-purple-200",
                  ProductionLog: "bg-blue-50 text-blue-700 border-blue-200",
                  Invoice: "bg-green-50 text-green-700 border-green-200",
                  SKU: "bg-orange-50 text-orange-700 border-orange-200",
                  VendorBill: "bg-red-50 text-red-700 border-red-200",
                  BOM: "bg-cyan-50 text-cyan-700 border-cyan-200",
                  Vendor: "bg-violet-50 text-violet-700 border-violet-200",
                  Customer: "bg-pink-50 text-pink-700 border-pink-200",
                  GoodsReceipt: "bg-emerald-50 text-emerald-700 border-emerald-200",
                  Machine: "bg-slate-100 text-slate-700 border-slate-200",
                  Routing: "bg-indigo-50 text-indigo-700 border-indigo-200",
                };
                const ac = actionColors[log.action] ?? { bg: "bg-gray-100 border-gray-200", text: "text-gray-700", dot: "bg-gray-500" };
                return {
                  time: (
                    <span className="text-xs text-text-muted whitespace-nowrap">{formatTimestamp(log.createdAt)}</span>
                  ),
                  user: (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent text-[10px] font-bold">
                        {log.actorName?.charAt(0)?.toUpperCase() ?? "?"}
                      </span>
                      <span className="font-medium text-sm">{log.actorName}</span>
                    </div>
                  ),
                  action: (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${ac.bg} ${ac.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ac.dot}`} />
                      {log.action}
                    </span>
                  ),
                  entity: (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${entityColors[log.entityType] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                      {log.entityType}
                    </span>
                  ),
                  summary: (
                    <div className="max-w-[350px] truncate text-sm text-text-muted" title={log.summary}>
                      {log.summary}
                    </div>
                  )
                };
              })}
              emptyLabel={loading ? "Loading activity..." : "No activity logged for this period."}
            />
          </div>
          <p className="px-2 py-2 text-xs text-text-muted text-center border-t border-gray-100 mt-2">
            {number.format(logs.length)} event{logs.length !== 1 ? "s" : ""}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
