"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { SectionHeader } from "@/components/SectionHeader";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type FinishedSku = {
  id: string;
  code: string;
  name: string;
  unit: string;
  scrapPct?: number | null;
  lowStockThreshold?: number | null;
  active: boolean;
};

type RawSku = { id: string; code: string; name: string; unit: string };

type Machine = { id: string; code: string; name: string };

type BomLine = { rawSkuId: string; quantity: number; scrapPct?: number | null };

type Bom = {
  id: string;
  finishedSkuId: string;
  version: number;
  name?: string | null;
  active?: boolean;
  lines: { rawSku: RawSku; rawSkuId: string; quantity: number; scrapPct?: number | null }[];
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

type RoutingLine = { id?: string; sequence: number; machineId: string; capacityPerMinute: number };

const emptyForm = {
  code: "",
  name: "",
  unit: "",
  scrapPct: "",
  lowStockThreshold: "",
  active: true
};

export default function FinishedSkusPage() {
  const [skus, setSkus] = useState<FinishedSku[]>([]);
  const [rawSkus, setRawSkus] = useState<RawSku[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [routings, setRoutings] = useState<Routing[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFinishedId, setSelectedFinishedId] = useState<string>("");
  const [selectedBomId, setSelectedBomId] = useState<string>("");
  const [bomName, setBomName] = useState<string>("");
  const [saveAsNewVersion, setSaveAsNewVersion] = useState(false);
  const [bomLines, setBomLines] = useState<BomLine[]>([]);
  const [routingLines, setRoutingLines] = useState<RoutingLine[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isTechno, setIsTechno] = useState(false);
  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [skuData, rawSkuData, bomData, machineData, routingData, userData] = await Promise.all([
        apiGet<FinishedSku[]>("/api/finished-skus"),
        apiGet<RawSku[]>("/api/raw-skus"),
        apiGet<Bom[]>("/api/boms"),
        apiGet<Machine[]>("/api/machines"),
        apiGet<Routing[]>("/api/routings"),
        apiGet<{ actorEmployeeCode: string | null }>("/api/active-user")
      ]);
      setSkus(skuData);
      setRawSkus(rawSkuData);
      setBoms(bomData);
      setMachines(machineData);
      setRoutings(routingData);
      setIsTechno(userData.actorEmployeeCode === "Techno");
      const defaultId = skuData[0]?.id ?? "";
      setSelectedFinishedId((prev) => prev || defaultId);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load finished SKUs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bomsForSelected = useMemo(
    () =>
      boms
        .filter((item) => item.finishedSkuId === selectedFinishedId)
        .slice()
        .sort((a, b) => b.version - a.version),
    [boms, selectedFinishedId]
  );

  useEffect(() => {
    if (!selectedFinishedId) {
      setSelectedBomId("");
      setBomLines([]);
      setBomName("");
      setSaveAsNewVersion(false);
      return;
    }
    if (!bomsForSelected.length) {
      setSelectedBomId("");
      setBomLines([]);
      setBomName("");
      setSaveAsNewVersion(false);
      return;
    }
    if (!bomsForSelected.some((bom) => bom.id === selectedBomId)) {
      setSelectedBomId(bomsForSelected[0].id);
    }
  }, [bomsForSelected, selectedFinishedId, selectedBomId]);

  const selectedBom = useMemo(
    () => bomsForSelected.find((bom) => bom.id === selectedBomId) ?? null,
    [bomsForSelected, selectedBomId]
  );

  useEffect(() => {
    if (!selectedBom) {
      setBomLines([]);
      setBomName("");
      return;
    }
    setBomLines(
      selectedBom.lines.map((line) => ({
        rawSkuId: line.rawSkuId,
        quantity: line.quantity,
        scrapPct: line.scrapPct ?? undefined
      }))
    );
    setBomName(selectedBom.name ?? "");
  }, [selectedBom]);

  useEffect(() => {
    if (!selectedFinishedId) {
      setRoutingLines([]);
      return;
    }
    const routing = routings.find((item) => item.finishedSkuId === selectedFinishedId);
    if (!routing || routing.steps.length === 0) {
      setRoutingLines([]);
      return;
    }
    setRoutingLines(
      routing.steps
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((step) => ({
          id: step.id,
          sequence: step.sequence,
          machineId: step.machineId,
          capacityPerMinute: step.capacityPerMinute
        }))
    );
  }, [routings, selectedFinishedId]);

  const bomMissingSet = useMemo(() => {
    const set = new Set<string>();
    skus.forEach((sku) => {
      if (!boms.some((bom) => bom.finishedSkuId === sku.id)) {
        set.add(sku.id);
      }
    });
    return set;
  }, [skus, boms]);

  const routingMissingSet = useMemo(() => {
    const set = new Set<string>();
    skus.forEach((sku) => {
      const routing = routings.find((item) => item.finishedSkuId === sku.id);
      if (!routing || routing.steps.length === 0) {
        set.add(sku.id);
      }
    });
    return set;
  }, [skus, routings]);

  const bomMissingList = useMemo(
    () => skus.filter((sku) => bomMissingSet.has(sku.id)).map((sku) => `${sku.code} · ${sku.name}`),
    [skus, bomMissingSet]
  );

  const routingMissingList = useMemo(
    () => skus.filter((sku) => routingMissingSet.has(sku.id)).map((sku) => `${sku.code} · ${sku.name}`),
    [skus, routingMissingSet]
  );

  const bomFinishedOptions = useMemo(
    () =>
      skus.map((sku) => ({
        value: sku.id,
        label: `${sku.code} · ${sku.name}${bomMissingSet.has(sku.id) ? " · Missing BOM" : ""}`
      })),
    [skus, bomMissingSet]
  );

  const bomVersionOptions = useMemo(
    () =>
      bomsForSelected.map((bom) => ({
        value: bom.id,
        label: `v${bom.version}${bom.name ? ` · ${bom.name}` : ""}${bom.active === false ? " · Inactive" : ""}`
      })),
    [bomsForSelected]
  );

  const nextBomVersion = useMemo(() => {
    if (!bomsForSelected.length) return 1;
    return Math.max(...bomsForSelected.map((bom) => bom.version)) + 1;
  }, [bomsForSelected]);

  const routingFinishedOptions = useMemo(
    () =>
      skus.map((sku) => ({
        value: sku.id,
        label: `${sku.code} · ${sku.name}${routingMissingSet.has(sku.id) ? " · Missing Routing" : ""}`
      })),
    [skus, routingMissingSet]
  );

  const rawOptions = useMemo(
    () => rawSkus.map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name}` })),
    [rawSkus]
  );

  const machineOptions = useMemo(
    () => machines.map((machine) => ({ value: machine.id, label: `${machine.code} · ${machine.name}` })),
    [machines]
  );

  function handleEdit(sku: FinishedSku) {
    setEditingId(sku.id);
    setForm({
      code: sku.code,
      name: sku.name,
      unit: sku.unit,
      scrapPct: sku.scrapPct?.toString() ?? "",
      lowStockThreshold: sku.lowStockThreshold?.toString() ?? "",
      active: sku.active
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      code: form.code,
      name: form.name,
      unit: form.unit,
      scrapPct: form.scrapPct ? Number(form.scrapPct) : undefined,
      lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : undefined,
      active: form.active
    };

    try {
      if (editingId) {
        await apiSend(`/api/finished-skus/${editingId}`, "PUT", payload);
        push("success", "Finished SKU updated");
      } else {
        await apiSend("/api/finished-skus", "POST", payload);
        push("success", "Finished SKU created");
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save finished SKU");
    }
  }

  const filtered = skus.filter((sku) => {
    const target = `${sku.code} ${sku.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  function addBomLine() {
    if (rawSkus.length === 0) {
      push("error", "Add raw SKUs before creating a BOM");
      return;
    }
    setBomLines((prev) => [...prev, { rawSkuId: rawSkus[0].id, quantity: 1 }]);
  }

  async function saveBom() {
    if (!selectedFinishedId) {
      push("error", "Select a finished SKU to map BOM");
      return;
    }
    if (bomLines.length === 0) {
      push("error", "Add at least one BOM line");
      return;
    }

    const rawSkuIdSet = new Set(bomLines.map((line) => line.rawSkuId));
    if (rawSkuIdSet.size !== bomLines.length) {
      push("error", "Duplicate raw SKUs are not allowed in a BOM");
      return;
    }

    const invalidLine = bomLines.find((line) => !line.rawSkuId || line.quantity <= 0);
    if (invalidLine) {
      push("error", "Each BOM line needs a raw SKU and quantity greater than 0");
      return;
    }

    const payload = {
      finishedSkuId: selectedFinishedId,
      name: bomName || undefined,
      lines: bomLines.map((line) => ({
        rawSkuId: line.rawSkuId,
        quantity: Number(line.quantity),
        scrapPct: line.scrapPct ? Number(line.scrapPct) : undefined
      }))
    };

    try {
      const existing = selectedBom;
      if (!existing || saveAsNewVersion) {
        await apiSend("/api/boms", "POST", payload);
        push("success", saveAsNewVersion ? `BOM v${nextBomVersion} created` : "BOM created");
      } else {
        await apiSend(`/api/boms/${existing.id}`, "PUT", payload);
        push("success", "BOM updated");
      }
      setSaveAsNewVersion(false);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save BOM");
    }
  }

  function addRoutingStep() {
    if (machines.length === 0) {
      push("error", "Add machines before creating routing steps");
      return;
    }
    const nextSequence =
      routingLines.length > 0 ? Math.max(...routingLines.map((line) => line.sequence)) + 1 : 1;
    setRoutingLines((prev) => [
      ...prev,
      { sequence: nextSequence, machineId: machines[0].id, capacityPerMinute: 1 }
    ]);
  }

  function renumberRouting(lines: RoutingLine[]) {
    return lines.map((line, index) => ({ ...line, sequence: index + 1 }));
  }

  function handleDrop(targetIndex: number) {
    setRoutingLines((prev) => {
      if (dragIndex == null || dragIndex === targetIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return renumberRouting(next);
    });
    setDragIndex(null);
  }

  async function saveRouting() {
    if (!selectedFinishedId) {
      push("error", "Select a finished SKU to map routing");
      return;
    }
    if (routingLines.length === 0) {
      push("error", "Add at least one routing step");
      return;
    }

    const sequenceSet = new Set(routingLines.map((line) => line.sequence));
    if (sequenceSet.size !== routingLines.length) {
      push("error", "Step numbers must be unique");
      return;
    }

    const invalidLine = routingLines.find(
      (line) => !line.machineId || line.capacityPerMinute <= 0 || line.sequence <= 0
    );
    if (invalidLine) {
      push("error", "Each routing step needs a machine, step number, and capacity greater than 0");
      return;
    }

    try {
      const existingRouting = routings.find((routing) => routing.finishedSkuId === selectedFinishedId);
      const payload = {
        finishedSkuId: selectedFinishedId,
        steps: routingLines
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((line) => ({
            sequence: Number(line.sequence),
            machineId: line.machineId,
            capacityPerMinute: Number(line.capacityPerMinute)
          }))
      };
      if (existingRouting) {
        await apiSend(`/api/routings/${existingRouting.id}`, "PUT", payload);
      } else {
        await apiSend("/api/routings", "POST", payload);
      }

      push("success", "Routing steps updated");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save routing steps");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Finished SKUs"
        subtitle="Define finished products and attach material mappings."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Finished SKU" : "Add Finished SKU"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="SKU Code"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  required
                />
                <Input
                  label="SKU Name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Unit"
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  required
                />
                <Input
                  label="Scrap % (optional)"
                  value={form.scrapPct}
                  onChange={(event) => setForm({ ...form, scrapPct: event.target.value })}
                  type="number"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Low Stock Threshold"
                  value={form.lowStockThreshold}
                  onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })}
                  type="number"
                  placeholder="e.g. 20"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                Active
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">{editingId ? "Save Changes" : "Create Finished SKU"}</Button>
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finished SKUs</CardTitle>
          </CardHeader>
          <CardBody>
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by code or name"
            />
            <div className="mt-6">
              <DataTable
                columns={[
                  { key: "code", label: "Code" },
                  { key: "name", label: "Product" },
                  { key: "unit", label: "Unit" },
                  { key: "threshold", label: "Low Stock" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((sku) => ({
                  code: sku.code,
                  name: sku.name,
                  unit: sku.unit,
                  threshold: sku.lowStockThreshold != null ? `${sku.lowStockThreshold} ${sku.unit}` : "—",
                  actions: (
                    <div className="flex gap-2">
                      {isTechno && (
                        <Button variant="ghost" onClick={() => handleEdit(sku)}>
                          Edit
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setSelectedFinishedId(sku.id)}>
                        Map
                      </Button>
                    </div>
                  )
                }))}
                emptyLabel={loading ? "Loading finished SKUs..." : "No finished SKUs found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card variant="strong">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            BOM Mapping
            {bomMissingSet.size > 0 ? (
              <Badge variant="warning" label={`${bomMissingSet.size} missing`} />
            ) : (
              <Badge variant="success" label="All mapped" />
            )}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {skus.length === 0 ? (
            <p className="text-sm text-text-muted">Create a finished SKU to map its bill of materials.</p>
          ) : (
            <div className="space-y-6">
              <Select
                label="Finished SKU"
                value={selectedFinishedId}
                onChange={(event) => setSelectedFinishedId(event.target.value)}
                options={bomFinishedOptions}
              />
              {bomVersionOptions.length ? (
                <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                  <Select
                    label="BOM Version"
                    value={selectedBomId}
                    onChange={(event) => {
                      setSelectedBomId(event.target.value);
                      setSaveAsNewVersion(false);
                    }}
                    options={bomVersionOptions}
                  />
                  <Input
                    label="BOM Name"
                    value={bomName}
                    onChange={(event) => setBomName(event.target.value)}
                    placeholder="e.g. High-grade batch"
                  />
                </div>
              ) : (
                <Input
                  label="BOM Name"
                  value={bomName}
                  onChange={(event) => setBomName(event.target.value)}
                  placeholder="e.g. First version"
                />
              )}
              {selectedFinishedId && bomsForSelected.length > 0 ? (
                <label className="flex items-center gap-2 text-sm text-text-muted">
                  <input
                    type="checkbox"
                    checked={saveAsNewVersion}
                    onChange={(event) => setSaveAsNewVersion(event.target.checked)}
                  />
                  Save as new version (v{nextBomVersion})
                </label>
              ) : null}
              {bomMissingList.length ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-3 text-xs text-text-muted">
                  Missing BOMs: {bomMissingList.join(", ")}
                </div>
              ) : null}
              {selectedFinishedId && bomMissingSet.has(selectedFinishedId) ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-3 text-xs text-text-muted">
                  This SKU does not have a BOM yet. Add raw materials below.
                </div>
              ) : null}
              {bomLines.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted">
                  No BOM lines yet. Add raw materials to define the recipe.
                </div>
              ) : (
                <div className="space-y-3">
                  {bomLines.map((line, index) => (
                    <div
                      key={`${line.rawSkuId}-${index}`}
                      className="grid gap-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-3 lg:grid-cols-[2fr_1fr_1fr_auto]"
                    >
                      <Select
                        label="Raw SKU"
                        value={line.rawSkuId}
                        onChange={(event) => {
                          const value = event.target.value;
                          setBomLines((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, rawSkuId: value } : item))
                          );
                        }}
                        options={rawOptions}
                      />
                      <Input
                        label="Quantity"
                        value={line.quantity.toString()}
                        onChange={(event) => {
                          const value = event.target.value;
                          setBomLines((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, quantity: Number(value) } : item))
                          );
                        }}
                        type="number"
                        required
                      />
                      <Input
                        label="Scrap %"
                        value={line.scrapPct?.toString() ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setBomLines((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, scrapPct: value ? Number(value) : undefined } : item
                            )
                          );
                        }}
                        type="number"
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setBomLines((prev) => prev.filter((_, idx) => idx !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={addBomLine}>
                  Add BOM Line
                </Button>
                <Button type="button" onClick={saveBom}>
                  Save BOM
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Machine Options (Routing)
            {routingMissingSet.size > 0 ? (
              <Badge variant="warning" label={`${routingMissingSet.size} missing`} />
            ) : (
              <Badge variant="success" label="All routed" />
            )}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {skus.length === 0 ? (
            <p className="text-sm text-text-muted">Create a finished SKU to build routing steps.</p>
          ) : machines.length === 0 ? (
            <p className="text-sm text-text-muted">Add machines before creating routing steps.</p>
          ) : (
            <div className="space-y-6">
              <Select
                label="Finished SKU"
                value={selectedFinishedId}
                onChange={(event) => setSelectedFinishedId(event.target.value)}
                options={routingFinishedOptions}
              />
              <p className="text-xs text-text-muted">
                Add every machine that can produce this SKU along with its capacity (units/min). These are treated as
                alternative machine options, and the fastest option is suggested during order planning and production logs.
              </p>
              {routingMissingList.length ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-3 text-xs text-text-muted">
                  Missing routing steps: {routingMissingList.join(", ")}
                </div>
              ) : null}
              {selectedFinishedId && routingMissingSet.has(selectedFinishedId) ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-3 text-xs text-text-muted">
                  This SKU does not have routing steps yet.
                </div>
              ) : null}
              {routingLines.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted">
                  No machine options yet. Add at least one machine with capacity for this SKU.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Drag to reorder options (optional)</p>
                  {routingLines.map((line, index) => (
                    <div
                      key={`${line.machineId}-${line.sequence}-${index}`}
                      className="grid gap-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-3 lg:grid-cols-[0.7fr_1.6fr_1fr_auto]"
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDrop(index)}
                    >
                      <Input
                        label="Step"
                        value={line.sequence.toString()}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setRoutingLines((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, sequence: value } : item))
                          );
                        }}
                        type="number"
                        required
                      />
                      <Select
                        label="Machine"
                        value={line.machineId}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRoutingLines((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, machineId: value } : item))
                          );
                        }}
                        options={machineOptions}
                      />
                      <Input
                        label="Capacity (units/min)"
                        value={line.capacityPerMinute.toString()}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRoutingLines((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, capacityPerMinute: Number(value) } : item
                            )
                          );
                        }}
                        type="number"
                        required
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setRoutingLines((prev) => prev.filter((_, idx) => idx !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={addRoutingStep}>
                  Add Step
                </Button>
                <Button type="button" onClick={saveRouting}>
                  Save Routing
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
