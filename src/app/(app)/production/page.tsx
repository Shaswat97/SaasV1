"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import {
  AlertCircle,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Package,
  Trash2,
  Users
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

const statusBadge: Record<string, { label: string; variant: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  OPEN: { label: "Open", variant: "warning" },
  CLOSED: { label: "Closed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "danger" }
};

const purposeOptions = [
  { value: "ORDER", label: "Order" },
  { value: "STOCK", label: "Stock Build" }
];

const crewRoleOptions = [
  { value: "OPERATOR", label: "Operator" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "HELPER", label: "Helper" }
];

type Machine = { id: string; code: string; name: string; baseCapacityPerMinute: number };

type Employee = { id: string; code: string; name: string };

type FinishedSku = { id: string; code: string; name: string; unit: string };

type RawSku = { id: string; code: string; name: string; unit: string };

type RawBatch = {
  id: string;
  skuId: string;
  batchNumber: string;
  receivedAt: string;
  quantityRemaining: number;
  costPerUnit: number;
};

type Bom = {
  finishedSkuId: string;
  version: number;
  lines: Array<{ rawSkuId: string; quantity: number; scrapPct?: number | null; rawSku: RawSku }>;
};

type RoutingStep = {
  id: string;
  machineId: string;
  sequence: number;
  capacityPerMinute: number;
  machine: Machine;
};

type Routing = {
  id: string;
  finishedSkuId: string;
  steps: RoutingStep[];
};

type BacklogLine = {
  id: string;
  soNumber: string;
  status: string;
  customer: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  unit: string;
  orderedQty: number;
  producedQty: number;
  openQty: number;
};

type ProductionLog = {
  id: string;
  purpose: string;
  status: string;
  plannedQty: number;
  startAt: string;
  closeAt?: string | null;
  goodQty: number;
  rejectQty: number;
  scrapQty: number;
  expectedRawQty?: number | null;
  actualRawQty?: number | null;
  expectedRawCost?: number | null;
  actualRawCost?: number | null;
  materialVariancePct?: number | null;
  oeePct?: number | null;
  notes?: string | null;
  closeNotes?: string | null;
  crewAssignments?: Array<{
    id: string;
    role: string;
    startAt: string;
    endAt?: string | null;
    employee: Employee;
  }>;
  consumptions?: Array<{
    rawSkuId: string;
    batchId?: string | null;
    quantity: number;
    bomQty?: number | null;
    costPerUnit?: number | null;
    rawSku: RawSku;
    batch?: RawBatch | null;
  }>;
  finishedSku: FinishedSku;
  machine: Machine;
  operator?: Employee | null;
  supervisor?: Employee | null;
  salesOrderLine?: {
    id: string;
    salesOrder: { soNumber?: string | null; customer: { name: string } };
  } | null;
};

type RawConsumptionRow = {
  rawSkuId: string;
  batchId: string;
  bomQty: string;
  quantity: string;
};

type CrewFormRow = {
  employeeId: string;
  role: string;
  startAt: string;
};

type CrewCloseRow = {
  crewId: string;
  employeeName: string;
  role: string;
  startAt: string;
  endAt: string;
};

function buildRawConsumptionRows(
  selectedCloseLog: ProductionLog,
  bomMap: Map<string, Bom>,
  rawBatches: RawBatch[],
  outputQty: number
): RawConsumptionRow[] {
  const bom = bomMap.get(selectedCloseLog.finishedSku.id);
  if (!bom) return [];
  const baseQty = Math.max(outputQty, 0);
  const rows: RawConsumptionRow[] = [];

  bom.lines.forEach((line) => {
    const plannedRawQty = baseQty ? baseQty * line.quantity : 0;
    let remaining = plannedRawQty;
    const skuBatches = rawBatches
      .filter((batch) => batch.skuId === line.rawSkuId && batch.quantityRemaining > 0)
      .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

    if (!skuBatches.length) {
      rows.push({
        rawSkuId: line.rawSkuId,
        batchId: "",
        bomQty: plannedRawQty ? plannedRawQty.toString() : "",
        quantity: plannedRawQty ? plannedRawQty.toString() : ""
      });
      return;
    }

    skuBatches.forEach((batch) => {
      if (remaining <= 0) return;
      const take = Math.min(remaining, batch.quantityRemaining);
      if (take <= 0) return;
      rows.push({
        rawSkuId: line.rawSkuId,
        batchId: batch.id,
        bomQty: take.toString(),
        quantity: take.toString()
      });
      remaining -= take;
    });

    if (remaining > 0) {
      rows.push({
        rawSkuId: line.rawSkuId,
        batchId: "",
        bomQty: remaining.toString(),
        quantity: remaining.toString()
      });
    }
  });

  return rows;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start) return "—";
  if (!end) return "In progress";
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return "—";
  const minutes = Math.round((endMs - startMs) / 60000);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours > 0) return `${hours}h ${remaining}m`;
  return `${remaining}m`;
}

function formatOrderNumber(value?: string | null, fallbackId?: string) {
  if (value && value.trim().length > 0) return value;
  if (!fallbackId) return "—";
  const suffix = fallbackId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return suffix ? `SO-${suffix}` : "—";
}

function formatMinutesToClock(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const totalMinutes = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function ProductionPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [finishedSkus, setFinishedSkus] = useState<FinishedSku[]>([]);
  const [rawSkus, setRawSkus] = useState<RawSku[]>([]);
  const [rawBatches, setRawBatches] = useState<RawBatch[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [routings, setRoutings] = useState<Routing[]>([]);
  const [backlog, setBacklog] = useState<BacklogLine[]>([]);
  const [backlogTab, setBacklogTab] = useState("all");
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [loading, setLoading] = useState(false);

  const [purpose, setPurpose] = useState("ORDER");
  const [orderLineId, setOrderLineId] = useState("");
  const [stockSkuId, setStockSkuId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [plannedQty, setPlannedQty] = useState("");
  const [startAt, setStartAt] = useState("");
  const [notes, setNotes] = useState("");
  const [crewRows, setCrewRows] = useState<CrewFormRow[]>([]);

  const [closeLogId, setCloseLogId] = useState("");
  const [goodQty, setGoodQty] = useState("");
  const [rejectQty, setRejectQty] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closeCrewRows, setCloseCrewRows] = useState<CrewCloseRow[]>([]);
  const [rawConsumptions, setRawConsumptions] = useState<RawConsumptionRow[]>([]);
  const [rawRowsAuto, setRawRowsAuto] = useState(true);

  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [machineData, employeeData, skuData, rawSkuData, rawBatchData, bomData, routingData, backlogData, logData] = await Promise.all([
        apiGet<Machine[]>("/api/machines"),
        apiGet<Employee[]>("/api/employees"),
        apiGet<FinishedSku[]>("/api/finished-skus"),
        apiGet<RawSku[]>("/api/raw-skus"),
        apiGet<RawBatch[]>("/api/raw-batches"),
        apiGet<Bom[]>("/api/boms"),
        apiGet<Routing[]>("/api/routings"),
        apiGet<BacklogLine[]>("/api/production-logs/backlog"),
        apiGet<ProductionLog[]>(`/api/production-logs?includeCancelled=${includeCancelled ? "true" : "false"}`)
      ]);
      setMachines(machineData);
      setEmployees(employeeData);
      setFinishedSkus(skuData);
      setRawSkus(rawSkuData);
      setRawBatches(rawBatchData);
      setBoms(bomData);
      setRoutings(routingData);
      setBacklog(backlogData);
      setLogs(logData);

      if (!machineId && machineData[0]) setMachineId(machineData[0].id);
      if (!stockSkuId && skuData[0]) setStockSkuId(skuData[0].id);
      if (!orderLineId && backlogData[0]) setOrderLineId(backlogData[0].id);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load production data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeCancelled]);

  const selectedLine = useMemo(
    () => backlog.find((line) => line.id === orderLineId),
    [backlog, orderLineId]
  );

  const selectedSkuId = useMemo(() => {
    if (purpose === "ORDER") return selectedLine?.skuId ?? "";
    return stockSkuId;
  }, [purpose, selectedLine, stockSkuId]);

  const routingForSelected = useMemo(
    () => routings.find((routing) => routing.finishedSkuId === selectedSkuId) ?? null,
    [routings, selectedSkuId]
  );

  const machineCapacityOptions = useMemo(() => {
    if (!routingForSelected || routingForSelected.steps.length === 0) return [];
    const map = new Map<string, { machineId: string; machineCode: string; machineName: string; capacityPerMinute: number }>();
    routingForSelected.steps.forEach((step) => {
      const existing = map.get(step.machineId);
      if (!existing || step.capacityPerMinute > existing.capacityPerMinute) {
        map.set(step.machineId, {
          machineId: step.machineId,
          machineCode: step.machine.code,
          machineName: step.machine.name,
          capacityPerMinute: step.capacityPerMinute
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.capacityPerMinute - a.capacityPerMinute);
  }, [routingForSelected]);

  const machineOptions = useMemo(
    () =>
      machineCapacityOptions.map((machine) => ({
        value: machine.machineId,
        label: `${machine.machineCode} · ${machine.machineName}`
      })),
    [machineCapacityOptions]
  );

  const machineCapacityMap = useMemo(() => {
    const map = new Map<string, number>();
    machineCapacityOptions.forEach((machine) => {
      map.set(machine.machineId, machine.capacityPerMinute);
    });
    return map;
  }, [machineCapacityOptions]);

  const machineOptionDetails = useMemo(() => {
    const planned = Number(plannedQty || 0);
    return machineCapacityOptions.map((machine) => ({
      ...machine,
      minutes: planned > 0 && machine.capacityPerMinute > 0 ? planned / machine.capacityPerMinute : null
    }));
  }, [machineCapacityOptions, plannedQty]);

  useEffect(() => {
    if (machineCapacityOptions.length === 0) return;
    const fastest = machineCapacityOptions[0];
    if (!machineId || !machineCapacityMap.has(machineId)) {
      setMachineId(fastest.machineId);
    }
  }, [machineCapacityOptions, machineCapacityMap, machineId]);

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ value: employee.id, label: `${employee.code} · ${employee.name}` })),
    [employees]
  );

  const skuOptions = useMemo(
    () => finishedSkus.map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name}` })),
    [finishedSkus]
  );

  const rawSkuOptions = useMemo(
    () => rawSkus.map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name}` })),
    [rawSkus]
  );

  const rawSkuMap = useMemo(() => new Map(rawSkus.map((sku) => [sku.id, sku])), [rawSkus]);
  const rawBatchMap = useMemo(() => new Map(rawBatches.map((batch) => [batch.id, batch])), [rawBatches]);
  const batchOptionsBySku = useMemo(() => {
    const map = new Map<string, Array<{ value: string; label: string }>>();
    rawBatches.forEach((batch) => {
      if (!map.has(batch.skuId)) map.set(batch.skuId, []);
      map.get(batch.skuId)!.push({
        value: batch.id,
        label: `${batch.batchNumber} · ${batch.quantityRemaining} @ ₹${batch.costPerUnit.toFixed(2)}`
      });
    });
    return map;
  }, [rawBatches]);

  const bomMap = useMemo(() => {
    const map = new Map<string, Bom>();
    boms
      .slice()
      .sort((a, b) => b.version - a.version)
      .forEach((bom) => {
        if (!map.has(bom.finishedSkuId)) {
          map.set(bom.finishedSkuId, bom);
        }
      });
    return map;
  }, [boms]);

  const orderLineOptions = useMemo(
    () =>
      backlog.map((line) => ({
        value: line.id,
        label: `${formatOrderNumber(line.soNumber, line.id)} · ${line.customer} · ${line.skuCode} (${line.openQty} ${line.unit})`
      })),
    [backlog]
  );

  const openLogs = useMemo(() => logs.filter((log) => log.status === "OPEN"), [logs]);

  const openLogOptions = useMemo(
    () =>
      openLogs.map((log) => ({
        value: log.id,
        label: `${log.finishedSku.code} · ${log.machine.code} · ${Math.max(
          log.plannedQty - log.goodQty,
          0
        )} ${log.finishedSku.unit} remaining`
      })),
    [openLogs]
  );

  const selectedCloseLog = useMemo(() => logs.find((log) => log.id === closeLogId), [logs, closeLogId]);
  const closeTotalQty = useMemo(
    () => Number(goodQty || 0) + Number(rejectQty || 0) + Number(scrapQty || 0),
    [goodQty, rejectQty, scrapQty]
  );
  const closeRemainingQty = useMemo(() => {
    if (!selectedCloseLog) return 0;
    return Math.max(selectedCloseLog.plannedQty - (selectedCloseLog.goodQty ?? 0), 0);
  }, [selectedCloseLog]);

  useEffect(() => {
    if (!machineOptions.length) {
      if (machineId) setMachineId("");
      return;
    }
    if (!machineOptions.some((option) => option.value === machineId)) {
      setMachineId(machineOptions[0].value);
    }
  }, [machineOptions, machineId]);

  useEffect(() => {
    if (!openLogs.length) {
      if (closeLogId) setCloseLogId("");
      return;
    }
    if (!openLogs.some((log) => log.id === closeLogId)) {
      setCloseLogId(openLogs[0].id);
    }
  }, [openLogs, closeLogId]);

  useEffect(() => {
    if (!selectedCloseLog) {
      setGoodQty("");
      setRejectQty("");
      setScrapQty("");
      setCloseCrewRows([]);
      setRawConsumptions([]);
      setRawRowsAuto(true);
      return;
    }
    setGoodQty("");
    setRejectQty("");
    setScrapQty("");
    const crewRowsForClose =
      selectedCloseLog.crewAssignments?.map((entry) => ({
        crewId: entry.id,
        employeeName: entry.employee.name,
        role: entry.role,
        startAt: toLocalInput(entry.startAt),
        endAt: toLocalInput(entry.endAt)
      })) ?? [];
    setCloseCrewRows(crewRowsForClose);
    setRawRowsAuto(true);
    setRawConsumptions(buildRawConsumptionRows(selectedCloseLog, bomMap, rawBatches, closeRemainingQty));
  }, [selectedCloseLog, bomMap, rawBatches, closeRemainingQty]);

  useEffect(() => {
    if (!selectedCloseLog || !rawRowsAuto) return;
    const outputQty = closeTotalQty > 0 ? closeTotalQty : closeRemainingQty;
    setRawConsumptions(buildRawConsumptionRows(selectedCloseLog, bomMap, rawBatches, outputQty));
  }, [selectedCloseLog, rawRowsAuto, closeTotalQty, closeRemainingQty, bomMap, rawBatches]);

  useEffect(() => {
    if (!closeAt) return;
    setCloseCrewRows((prev) =>
      prev.map((row) => (row.endAt ? row : { ...row, endAt: closeAt }))
    );
  }, [closeAt]);

  function addCrewRow() {
    if (!employees.length) {
      push("error", "Add employees before assigning crew");
      return;
    }
    setCrewRows((prev) => [
      ...prev,
      {
        employeeId: employees[0].id,
        role: "OPERATOR",
        startAt
      }
    ]);
  }

  function addRawConsumptionRow() {
    if (!rawSkus.length) {
      push("error", "Add raw SKUs before logging consumption");
      return;
    }
    setRawRowsAuto(false);
    const firstSkuId = rawSkus[0].id;
    const firstBatchId = (batchOptionsBySku.get(firstSkuId) ?? [])[0]?.value ?? "";
    setRawConsumptions((prev) => [
      ...prev,
      { rawSkuId: firstSkuId, batchId: firstBatchId, bomQty: "", quantity: "" }
    ]);
  }

  async function startLog(event: FormEvent) {
    event.preventDefault();

    if (!machineId) {
      if (!routingForSelected || routingForSelected.steps.length === 0) {
        push("error", "No routing steps mapped for this SKU. Map routing before starting production.");
      } else {
        push("error", "Select a machine");
      }
      return;
    }

    if (purpose === "ORDER" && !orderLineId) {
      push("error", "Select a sales order line");
      return;
    }

    if (purpose === "STOCK" && !stockSkuId) {
      push("error", "Select a finished SKU");
      return;
    }

    const qty = Number(plannedQty);
    if (!qty || qty <= 0) {
      push("error", "Planned quantity must be greater than 0");
      return;
    }

    const crewPayload = crewRows
      .filter((row) => row.employeeId)
      .map((row) => ({
        employeeId: row.employeeId,
        role: row.role,
        startAt: row.startAt ? new Date(row.startAt).toISOString() : undefined
      }));
    if (crewRows.length > 0 && crewPayload.length === 0) {
      push("error", "Add at least one crew member or remove the empty row");
      return;
    }

    try {
      await apiSend("/api/production-logs/start", "POST", {
        purpose,
        salesOrderLineId: purpose === "ORDER" ? orderLineId : undefined,
        finishedSkuId: purpose === "STOCK" ? stockSkuId : undefined,
        machineId,
        plannedQty: qty,
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        crew: crewPayload.length ? crewPayload : undefined,
        notes: notes || undefined
      });
      push("success", "Production log started");
      setPlannedQty("");
      setStartAt("");
      setNotes("");
      setCrewRows([]);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to start production");
    }
  }

  async function closeLog(event: FormEvent) {
    event.preventDefault();
    if (!closeLogId) {
      push("error", "Select a log to close");
      return;
    }

    if (!goodQty.trim()) {
      push("error", "Good Qty is required to close the log");
      return;
    }
    const good = Number(goodQty);
    const reject = Number(rejectQty || 0);
    const scrap = Number(scrapQty || 0);
    if (!Number.isFinite(good) || good <= 0) {
      push("error", "Good Qty must be greater than 0");
      return;
    }
    if (!Number.isFinite(reject) || !Number.isFinite(scrap)) {
      push("error", "Reject and Scrap Qty must be valid numbers");
      return;
    }
    const consumptionPayload = rawConsumptions
      .filter((row) => row.rawSkuId)
      .map((row) => ({
        rawSkuId: row.rawSkuId,
        batchId: row.batchId || undefined,
        bomQty: row.bomQty ? Number(row.bomQty) : undefined,
        quantity: Number(row.quantity || 0)
      }));
    const keySet = new Set(consumptionPayload.map((row) => `${row.rawSkuId}:${row.batchId ?? "NO_BATCH"}`));
    if (keySet.size !== consumptionPayload.length) {
      push("error", "Duplicate raw SKU + batch rows are not allowed in consumption");
      return;
    }
    if (consumptionPayload.some((row) => row.quantity < 0)) {
      push("error", "Raw consumption quantities cannot be negative");
      return;
    }
    try {
      await apiSend(`/api/production-logs/${closeLogId}/close`, "POST", {
        goodQty: good,
        rejectQty: reject,
        scrapQty: scrap,
        closeAt: closeAt ? new Date(closeAt).toISOString() : undefined,
        crew: closeCrewRows.map((row) => ({
          crewId: row.crewId,
          endAt: row.endAt ? new Date(row.endAt).toISOString() : undefined
        })),
        closeNotes: closeNotes || undefined,
        rawConsumptions: consumptionPayload.length ? consumptionPayload : undefined
      });
      push("success", "Production log closed");
      setCloseLogId("");
      setGoodQty("");
      setRejectQty("");
      setScrapQty("");
      setCloseAt("");
      setCloseNotes("");
      setCloseCrewRows([]);
      setRawConsumptions([]);
      setRawRowsAuto(true);
      setCrewRows([]);
      setStartAt("");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to close log");
    }
  }

  async function cancelLog(logId: string) {
    try {
      await apiSend(`/api/production-logs/${logId}`, "DELETE", { reason: "Deleted in UI" });
      push("success", "Log deleted");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to delete log");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Production"
        subtitle="Log daily production starts, closes, and keep WIP and finished stock aligned."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Start Production Log</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={startLog}>
              <Select label="Purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} options={purposeOptions} />
              {purpose === "ORDER" ? (
                <Select
                  label="Sales Order Line"
                  value={orderLineId}
                  onChange={(event) => setOrderLineId(event.target.value)}
                  options={orderLineOptions}
                  required
                />
              ) : (
                <Select
                  label="Finished SKU"
                  value={stockSkuId}
                  onChange={(event) => setStockSkuId(event.target.value)}
                  options={skuOptions}
                  required
                />
              )}
              {purpose === "ORDER" && selectedLine ? (
                <div className="rounded-2xl border border-border/70 bg-bg-subtle/80 p-3 text-xs text-text-muted">
                  Open qty: {selectedLine.openQty} {selectedLine.unit} · Order {formatOrderNumber(selectedLine.soNumber, selectedLine.id)}
                </div>
              ) : null}
              <Select
                label="Machine"
                value={machineId}
                onChange={(event) => setMachineId(event.target.value)}
                options={machineOptions}
                required
              />
              {routingForSelected && routingForSelected.steps.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-3 text-xs text-text-muted">
                  No routing steps mapped for this SKU. Map in Settings &gt; Master Data &gt; Finished SKUs &gt; Routing Steps.
                </div>
              ) : null}
              {machineOptionDetails.length ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-3 text-xs text-text-muted">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Machine Options</p>
                  <div className="mt-2 space-y-2">
                    {machineOptionDetails.map((machine, index) => (
                      <div key={machine.machineId} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-text">
                            {machine.machineCode} · {machine.machineName}
                          </div>
                          <div>
                            Capacity: {machine.capacityPerMinute.toFixed(2).replace(/\.00$/, "")} units/min
                          </div>
                        </div>
                        <div className="text-right">
                          {machine.minutes != null ? (
                            <div className={index === 0 ? "font-semibold text-text" : ""}>
                              {formatMinutesToClock(machine.minutes)}
                            </div>
                          ) : (
                            <div>Enter planned qty</div>
                          )}
                          {index === 0 ? <div className="text-[10px] text-success">Fastest option</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <Input
                label="Planned Quantity"
                type="number"
                value={plannedQty}
                onChange={(event) => setPlannedQty(event.target.value)}
                required
              />
              {machineId && machineCapacityMap.has(machineId) ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-3 text-xs text-text-muted">
                  {(() => {
                    const capacity = machineCapacityMap.get(machineId) ?? 0;
                    if (capacity <= 0) {
                      return <div>Capacity missing for this machine and SKU. Update routing capacity.</div>;
                    }
                    const perHour = capacity * 60;
                    const planned = Number(plannedQty || 0);
                    const requiredMinutes = planned > 0 && capacity > 0 ? planned / capacity : 0;
                    const shiftOutput = capacity * 480;
                    return (
                      <>
                        <div>Capacity: {capacity.toFixed(2).replace(/\\.00$/, "")} units/min ({perHour.toFixed(0)} units/hr).</div>
                        <div>Estimated output in 8h shift: {shiftOutput.toFixed(0)} units.</div>
                        {planned > 0 ? (
                          <div>Estimated shift length for planned qty (HH:MM): {formatMinutesToClock(requiredMinutes)}.</div>
                        ) : (
                          <div>Enter planned qty to estimate required shift length.</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : null}
              <Input
                label="Start Time"
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
              />
              <div className="space-y-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text">Crew Assignment</p>
                  <Button type="button" variant="ghost" onClick={addCrewRow}>
                    Add Crew
                  </Button>
                </div>
                {crewRows.length === 0 ? (
                  <p className="text-xs text-text-muted">Add the operators and supervisors assigned to this machine.</p>
                ) : (
                  crewRows.map((row, index) => (
                    <div key={`${row.employeeId}-${index}`} className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
                      <Select
                        label="Employee"
                        value={row.employeeId}
                        onChange={(event) => {
                          const value = event.target.value;
                          setCrewRows((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, employeeId: value } : item))
                          );
                        }}
                        options={employeeOptions}
                      />
                      <Select
                        label="Role"
                        value={row.role}
                        onChange={(event) => {
                          const value = event.target.value;
                          setCrewRows((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, role: value } : item))
                          );
                        }}
                        options={crewRoleOptions}
                      />
                      <Input
                        label="Crew Start"
                        type="datetime-local"
                        value={row.startAt}
                        onChange={(event) => {
                          const value = event.target.value;
                          setCrewRows((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, startAt: value } : item))
                          );
                        }}
                      />
                      <div className="lg:col-span-3 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setCrewRows((prev) => prev.filter((_, idx) => idx !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Input
                label="Notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Shift notes, setup info"
              />
              <Button type="submit">Start Log</Button>
            </form>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Close Production Log</CardTitle>
            </CardHeader>
            <CardBody>
              <form className="space-y-4" onSubmit={closeLog}>
                <Select
                  label="Open Log"
                  value={closeLogId}
                  onChange={(event) => setCloseLogId(event.target.value)}
                  options={openLogOptions}
                  required
                />
                {closeCrewRows.length ? (
                  <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                    <p className="text-sm font-medium text-text">Crew End Time</p>
                    <div className="mt-3 space-y-3">
                      {closeCrewRows.map((row, index) => (
                        <div key={row.crewId} className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
                          <div>
                            <p className="text-sm font-medium">{row.employeeName}</p>
                            <p className="text-xs text-text-muted">{row.role}</p>
                          </div>
                          <Input label="Start" type="datetime-local" value={row.startAt} readOnly />
                          <Input
                            label="End"
                            type="datetime-local"
                            value={row.endAt}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCloseCrewRows((prev) =>
                                prev.map((item, idx) => (idx === index ? { ...item, endAt: value } : item))
                              );
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <Input label="Good Qty" type="number" required value={goodQty} onChange={(event) => setGoodQty(event.target.value)} />
                <Input
                  label="Reject Qty"
                  type="number"
                  value={rejectQty}
                  onChange={(event) => setRejectQty(event.target.value)}
                />
                <Input
                  label="Scrap Qty"
                  type="number"
                  value={scrapQty}
                  onChange={(event) => setScrapQty(event.target.value)}
                />
                <div className="space-y-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text">Raw Consumption (Actual)</p>
                    <Button type="button" variant="ghost" onClick={addRawConsumptionRow}>
                      Add Raw
                    </Button>
                  </div>
                  {rawConsumptions.length === 0 ? (
                    <p className="text-xs text-text-muted">No raw consumption recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {rawConsumptions.map((row, index) => {
                        const raw = rawSkuMap.get(row.rawSkuId);
                        const batchOptions = batchOptionsBySku.get(row.rawSkuId) ?? [];
                        const batch = row.batchId ? rawBatchMap.get(row.batchId) : undefined;
                        return (
                          <div
                            key={`${row.rawSkuId}-${index}`}
                            className="grid gap-3 lg:grid-cols-[1.8fr_2.2fr_1fr_1fr_auto]"
                          >
                            <Select
                              label="Raw SKU"
                              value={row.rawSkuId}
                              onChange={(event) => {
                                const value = event.target.value;
                                const nextBatchId = (batchOptionsBySku.get(value) ?? [])[0]?.value ?? "";
                                setRawConsumptions((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index ? { ...item, rawSkuId: value, batchId: nextBatchId } : item
                                  )
                                );
                                setRawRowsAuto(false);
                              }}
                              options={rawSkuOptions}
                            />
                            <Select
                              label="Batch"
                              value={row.batchId}
                              onChange={(event) => {
                                const value = event.target.value;
                                setRawConsumptions((prev) =>
                                  prev.map((item, idx) => (idx === index ? { ...item, batchId: value } : item))
                                );
                                setRawRowsAuto(false);
                              }}
                              options={[{ value: "", label: "No batch selected" }, ...batchOptions]}
                            />
                            <Input
                              label={`BOM Qty${raw ? ` (${raw.unit})` : ""}`}
                              type="number"
                              value={row.bomQty}
                              onChange={(event) => {
                                const value = event.target.value;
                                setRawConsumptions((prev) =>
                                  prev.map((item, idx) => (idx === index ? { ...item, bomQty: value } : item))
                                );
                                setRawRowsAuto(false);
                              }}
                            />
                            <Input
                              label={`Quantity${raw ? ` (${raw.unit})` : ""}`}
                              type="number"
                              value={row.quantity}
                              onChange={(event) => {
                                const value = event.target.value;
                                setRawConsumptions((prev) =>
                                  prev.map((item, idx) => (idx === index ? { ...item, quantity: value } : item))
                                );
                                setRawRowsAuto(false);
                              }}
                            />
                            <div className="flex flex-col justify-end pb-2 text-xs text-text-muted">
                              CP: {batch ? `₹${batch.costPerUnit.toFixed(2)}` : "—"}
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setRawConsumptions((prev) => prev.filter((_, idx) => idx !== index));
                                  setRawRowsAuto(false);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-text-muted">
                    Select raw batch + quantity to track lot-wise CP and BOM-to-actual usage.
                  </p>
                </div>
                <Input
                  label="Close Time"
                  type="datetime-local"
                  value={closeAt}
                  onChange={(event) => setCloseAt(event.target.value)}
                />
                <Input
                  label="Close Notes"
                  value={closeNotes}
                  onChange={(event) => setCloseNotes(event.target.value)}
                  placeholder="Quality notes, shift handoff"
                />
                <Button type="submit">Close Log</Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <div className="px-6 pt-5 pb-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-1">
                  {[
                    { key: "all", label: "All", filter: () => true },
                    { key: "QUOTE", label: "Quote", filter: (l: typeof backlog[0]) => l.status === "QUOTE" },
                    { key: "CONFIRMED", label: "Confirmed", filter: (l: typeof backlog[0]) => l.status === "CONFIRMED" },
                    { key: "PRODUCTION", label: "Production", filter: (l: typeof backlog[0]) => l.status === "PRODUCTION" },
                  ].map((tab) => {
                    const count = tab.key === "all" ? backlog.length : backlog.filter(tab.filter).length;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setBacklogTab(tab.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${(backlogTab ?? "all") === tab.key
                          ? "bg-gray-900 text-white"
                          : "text-gray-500 hover:bg-gray-100"
                          }`}
                      >
                        {tab.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <CardBody className="pt-3">
              <div className="max-h-[600px] overflow-y-auto">
                <DataTable
                  columns={[
                    { key: "order", label: "Order" },
                    { key: "customer", label: "Customer" },
                    { key: "sku", label: "SKU" },
                    { key: "open", label: "Open Qty", align: "right" as const },
                    { key: "status", label: "Status" }
                  ]}
                  rows={backlog
                    .filter((line) => {
                      if (!backlogTab || backlogTab === "all") return true;
                      return line.status === backlogTab;
                    })
                    .map((line) => ({
                      order: <span className="font-semibold text-accent">{line.soNumber}</span>,
                      customer: line.customer,
                      sku: (
                        <span className="text-sm">
                          <span className="font-medium text-text">{line.skuCode}</span>
                          <span className="text-text-muted"> · {line.skuName}</span>
                        </span>
                      ),
                      open: (
                        <span className={`font-medium ${line.openQty > 500 ? "text-red-600" : line.openQty > 100 ? "text-orange-600" : "text-green-600"}`}>
                          {line.openQty.toLocaleString()} {line.unit}
                        </span>
                      ),
                      status: (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${line.status === "PRODUCTION" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          line.status === "CONFIRMED" ? "bg-green-50 text-green-700 border border-green-200" :
                            line.status === "QUOTE" ? "bg-yellow-50 text-yellow-700 border border-yellow-200" :
                              "bg-gray-100 text-gray-700 border border-gray-200"
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${line.status === "PRODUCTION" ? "bg-blue-500" :
                            line.status === "CONFIRMED" ? "bg-green-500" :
                              line.status === "QUOTE" ? "bg-yellow-500" :
                                "bg-gray-500"
                            }`} />
                          {line.status === "PRODUCTION" ? "Production" : line.status === "CONFIRMED" ? "Confirmed" : line.status === "QUOTE" ? "Quote" : line.status}
                        </span>
                      )
                    }))}
                  emptyLabel={loading ? "Loading backlog..." : "No production backlog."}
                />
              </div>
              <p className="px-2 py-2 text-xs text-text-muted text-center border-t border-gray-100">
                {backlog.filter((line) => (!backlogTab || backlogTab === "all") ? true : line.status === backlogTab).length} item{backlog.filter((line) => (!backlogTab || backlogTab === "all") ? true : line.status === backlogTab).length !== 1 ? "s" : ""}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <div className="px-6 pt-5 pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-text mr-2">Production Logs</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">{logs.length}</span>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(event) => setIncludeCancelled(event.target.checked)}
                className="rounded"
              />
              Show cancelled
            </label>
          </div>
        </div>
        <CardBody className="pt-3">
          <div className="max-h-[600px] overflow-y-auto">
            <DataTable
              columns={[
                { key: "date", label: "Date" },
                { key: "start", label: "Start" },
                { key: "close", label: "Close" },
                { key: "purpose", label: "Purpose" },
                { key: "sku", label: "SKU" },
                { key: "machine", label: "Machine" },
                { key: "crew", label: "Crew", align: "right" },
                { key: "planned", label: "Planned", align: "right" },
                { key: "good", label: "Good", align: "right" },
                { key: "scrap", label: "Scrap", align: "right" },
                { key: "variance", label: "Var", align: "right" },
                { key: "materialVar", label: "Material Var%", align: "right" },
                { key: "rate", label: "Units/hr", align: "right" },
                { key: "oee", label: "OEE", align: "right" },
                { key: "crewTime", label: "Crew Time" },
                { key: "notes", label: "Notes" },
                { key: "status", label: "Status" },
                { key: "actions", label: "" }
              ]}
              rows={logs.map((log) => {
                const routing = routings.find((r) => r.finishedSkuId === log.finishedSku.id);
                const step = routing?.steps.find((s) => s.machineId === log.machine.id);
                const capacity = step?.capacityPerMinute ?? log.machine.baseCapacityPerMinute ?? 0;
                let varianceNode = <span className="text-text-muted">—</span>;

                if (log.closeAt && log.startAt && capacity > 0 && log.plannedQty > 0) {
                  const actualMinutes = (new Date(log.closeAt).getTime() - new Date(log.startAt).getTime()) / 60000;
                  const standardMinutes = log.plannedQty / capacity;
                  const variance = actualMinutes - standardMinutes;
                  const isDelay = variance > 0;
                  varianceNode = (
                    <div className={`flex flex-col items-end ${isDelay ? "text-danger" : "text-success"}`}>
                      <span className="font-medium">
                        {isDelay ? "+" : ""}{Math.round(variance)}m
                      </span>
                      <span className="text-[10px] text-text-muted/70">
                        {Math.round(actualMinutes)}m act
                      </span>
                    </div>
                  );
                }

                const statusConfig = statusBadge[log.status] ?? statusBadge.OPEN;
                const statusColor =
                  statusConfig.variant === "success"
                    ? "bg-success"
                    : statusConfig.variant === "warning"
                      ? "bg-warning"
                      : statusConfig.variant === "danger"
                        ? "bg-danger"
                        : "bg-text-muted";

                return {
                  date: (
                    <div className="flex flex-col">
                      <span className="font-medium text-text">{formatDate(log.startAt)}</span>
                      <span className="text-xs text-text-muted">{formatTime(log.startAt)}</span>
                    </div>
                  ),
                  start: <span className="text-text-muted">{formatTime(log.startAt)}</span>,
                  close: <span className="text-text-muted">{formatTime(log.closeAt)}</span>,
                  purpose: (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs font-medium text-text-muted">
                      {log.purpose === "ORDER" ? "Order" : "Stock"}
                    </span>
                  ),
                  sku: (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-text">{log.finishedSku.code}</span>
                        <span className="text-xs text-text-muted">{log.finishedSku.name}</span>
                      </div>
                    </div>
                  ),
                  machine: (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-subtle text-text-muted/80">
                        <Box className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-text">{log.machine.name}</span>
                        <span className="text-xs text-text-muted">{log.machine.code}</span>
                      </div>
                    </div>
                  ),
                  crew: log.crewAssignments?.length ? (
                    <div className="flex items-center justify-end gap-1.5" title="Crew Details">
                      <Users className="h-3.5 w-3.5 text-text-muted" />
                      <span className="text-sm text-text">
                        {log.crewAssignments.reduce((acc, c) => acc + (c.role === "OPERATOR" ? 1 : 0), 0)} Ops
                      </span>
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  ),
                  planned: (
                    <div className="flex flex-col items-end">
                      <span className="font-medium text-text">{log.plannedQty}</span>
                      <span className="text-xs text-text-muted">{log.finishedSku.unit}</span>
                    </div>
                  ),
                  good: (
                    <div className="flex flex-col items-end">
                      <span className="font-medium text-text">{log.goodQty ?? "—"}</span>
                      {log.goodQty ? <span className="text-xs text-success">Good</span> : null}
                    </div>
                  ),
                  scrap: (
                    <div className="flex flex-col items-end">
                      <span className="text-text">{log.scrapQty || log.rejectQty ? log.scrapQty + log.rejectQty : "—"}</span>
                      {log.scrapQty || log.rejectQty ? <span className="text-xs text-danger">Lost</span> : null}
                    </div>
                  ),
                  variance: varianceNode,
                  materialVar: log.materialVariancePct != null ? (
                    <span
                      className={
                        log.materialVariancePct > 5
                          ? "font-medium text-danger"
                          : log.materialVariancePct < -5
                            ? "font-medium text-success"
                            : "text-text-muted"
                      }
                    >
                      {log.materialVariancePct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  ),
                  rate: (() => {
                    if (!log.closeAt || !log.goodQty) return <span className="text-text-muted">—</span>;
                    const hours = (new Date(log.closeAt).getTime() - new Date(log.startAt).getTime()) / 3600000;
                    if (!hours || hours <= 0) return <span className="text-text-muted">—</span>;
                    const rate = log.goodQty / hours;
                    return (
                      <div className="flex flex-col items-end">
                        <span className="font-medium text-text">{rate.toFixed(0)}</span>
                        <span className="text-xs text-text-muted">u/hr</span>
                      </div>
                    );
                  })(),
                  oee: log.oeePct ? (
                    <div className="flex flex-col items-end">
                      <span className="font-medium text-text">{log.oeePct.toFixed(0)}%</span>
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  ),
                  crewTime: log.crewAssignments?.length ? (
                    <div className="max-w-[120px] truncate text-xs text-text-muted">
                      {log.crewAssignments.map((e) => e.employee.name).join(", ")}
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  ),
                  notes: log.notes ? (
                    <div className="max-w-[150px] truncate text-xs text-text-muted" title={log.notes}>
                      {log.notes}
                    </div>
                  ) : (
                    <span className="text-text-muted">—</span>
                  ),
                  status: (
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                      <span className="text-sm font-medium text-text">{statusConfig.label}</span>
                    </div>
                  ),
                  actions:
                    log.status !== "CANCELLED" ? (
                      <Button variant="ghost" className="h-8 w-8 p-0 text-text-muted hover:text-danger" onClick={() => cancelLog(log.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      ""
                    )
                };
              })}
              emptyLabel={loading ? "Loading logs..." : "No production logs yet."}
            />
          </div>
          <p className="px-2 py-2 text-xs text-text-muted text-center border-t border-gray-100">
            {logs.length} log{logs.length !== 1 ? "s" : ""}
          </p>
        </CardBody>
      </Card>
    </div >
  );
}
