"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { apiGet } from "@/lib/api-client";

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
  const today = new Date();
  const fromDefault = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(fromDefault.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
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
  }, [from, to, entity, action, actor, search]);

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
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-4">
            <Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <Select label="Entity" value={entity} onChange={(event) => setEntity(event.target.value)} options={entityOptions} />
            <Select label="Action" value={action} onChange={(event) => setAction(event.target.value)} options={actionOptions} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order number, SKU, or summary" />
            <Select label="User" value={actor} onChange={(event) => setActor(event.target.value)} options={actorOptions} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardBody>
          <DataTable
            columns={[
              { key: "time", label: "Time" },
              { key: "user", label: "User" },
              { key: "action", label: "Action" },
              { key: "entity", label: "Entity" },
              { key: "summary", label: "Summary" }
            ]}
            rows={logs.map((log) => ({
              time: formatTimestamp(log.createdAt),
              user: log.actorName,
              action: log.action,
              entity: log.entityType,
              summary: log.summary
            }))}
            emptyLabel={loading ? "Loading activity..." : "No activity logged for this period."}
          />
          <p className="mt-3 text-xs text-text-muted">Showing {number.format(logs.length)} events.</p>
        </CardBody>
      </Card>
    </div>
  );
}
