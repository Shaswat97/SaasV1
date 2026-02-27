"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { SectionHeader } from "@/components/SectionHeader";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type Machine = { id: string; code: string; name: string };

type FinishedSku = { id: string; code: string; name: string };

type MachineSku = {
  id: string;
  machineId: string;
  skuId: string;
  capacityPerMinute: number;
  active: boolean;
  machine: Machine;
  sku: FinishedSku;
};

const emptyForm = {
  machineId: "",
  skuId: "",
  capacityPerMinute: "",
  active: true
};

export default function MachineSkusPage() {
  const [machineSkus, setMachineSkus] = useState<MachineSku[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [skus, setSkus] = useState<FinishedSku[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTechno, setIsTechno] = useState(false);
  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [machineSkuData, machineData, skuData, userData] = await Promise.all([
        apiGet<MachineSku[]>("/api/machine-skus"),
        apiGet<Machine[]>("/api/machines"),
        apiGet<FinishedSku[]>("/api/finished-skus"),
        apiGet<{ actorEmployeeCode: string | null }>("/api/active-user")
      ]);
      setMachineSkus(machineSkuData);
      setMachines(machineData);
      setSkus(skuData);
      setIsTechno(userData.actorEmployeeCode === "Techno");
      setForm((prev) => ({
        ...prev,
        machineId: prev.machineId || machineData[0]?.id || "",
        skuId: prev.skuId || skuData[0]?.id || ""
      }));
    } catch (error: any) {
      push("error", error.message ?? "Failed to load machine SKUs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const machineOptions = useMemo(
    () => machines.map((machine) => ({ value: machine.id, label: `${machine.code} · ${machine.name}` })),
    [machines]
  );

  const skuOptions = useMemo(
    () => skus.map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name}` })),
    [skus]
  );

  function handleEdit(machineSku: MachineSku) {
    setEditingId(machineSku.id);
    setForm({
      machineId: machineSku.machineId,
      skuId: machineSku.skuId,
      capacityPerMinute: machineSku.capacityPerMinute.toString(),
      active: machineSku.active
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      machineId: machines[0]?.id ?? "",
      skuId: skus[0]?.id ?? ""
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      machineId: form.machineId,
      skuId: form.skuId,
      capacityPerMinute: Number(form.capacityPerMinute),
      active: form.active
    };

    try {
      if (editingId) {
        await apiSend(`/api/machine-skus/${editingId}`, "PUT", payload);
        push("success", "Machine SKU updated");
      } else {
        await apiSend("/api/machine-skus", "POST", payload);
        push("success", "Machine SKU created");
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save machine SKU");
    }
  }

  const filtered = machineSkus.filter((item) => {
    const target = `${item.machine.code} ${item.sku.code} ${item.sku.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Machine SKUs"
        subtitle="Define throughput by machine for each finished SKU."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Machine SKU" : "Add Machine SKU"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Select
                label="Machine"
                value={form.machineId}
                onChange={(event) => setForm({ ...form, machineId: event.target.value })}
                options={machineOptions}
                required
              />
              <Select
                label="Finished SKU"
                value={form.skuId}
                onChange={(event) => setForm({ ...form, skuId: event.target.value })}
                options={skuOptions}
                required
              />
              <Input
                label="Capacity (units/min)"
                value={form.capacityPerMinute}
                onChange={(event) => setForm({ ...form, capacityPerMinute: event.target.value })}
                type="number"
                required
              />
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                Active
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">{editingId ? "Save Changes" : "Create Machine SKU"}</Button>
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
            <CardTitle>Machine SKU Map</CardTitle>
          </CardHeader>
          <CardBody>
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by machine or SKU"
            />
            <div className="mt-6">
              <DataTable
                columns={[
                  { key: "machine", label: "Machine" },
                  { key: "sku", label: "Finished SKU" },
                  { key: "capacity", label: "Units/min", align: "right" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((item) => ({
                  machine: item.machine.name,
                  sku: item.sku.name,
                  capacity: item.capacityPerMinute,
                  actions: isTechno ? (
                    <Button variant="ghost" onClick={() => handleEdit(item)}>
                      Edit
                    </Button>
                  ) : null
                }))}
                emptyLabel={loading ? "Loading machine SKUs..." : "No machine SKUs found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
