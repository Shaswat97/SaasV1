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

type Machine = {
  id: string;
  code: string;
  name: string;
  model?: string | null;
  category?: string | null;
  baseCapacityPerMinute: number;
  active: boolean;
};

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

const emptyMachineForm = {
  code: "",
  name: "",
  model: "",
  category: "",
  baseCapacityPerMinute: "",
  active: true
};

const emptyMachineSkuForm = {
  machineId: "",
  skuId: "",
  capacityPerMinute: "",
  active: true
};

export default function MachinesRoutingPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineSkus, setMachineSkus] = useState<MachineSku[]>([]);
  const [skus, setSkus] = useState<FinishedSku[]>([]);
  const [loading, setLoading] = useState(false);

  const [machineSearch, setMachineSearch] = useState("");
  const [machineSkuSearch, setMachineSkuSearch] = useState("");

  const [machineForm, setMachineForm] = useState({ ...emptyMachineForm });
  const [machineEditingId, setMachineEditingId] = useState<string | null>(null);

  const [machineSkuForm, setMachineSkuForm] = useState({ ...emptyMachineSkuForm });
  const [machineSkuEditingId, setMachineSkuEditingId] = useState<string | null>(null);

  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [machineData, machineSkuData, skuData] = await Promise.all([
        apiGet<Machine[]>("/api/machines"),
        apiGet<MachineSku[]>("/api/machine-skus"),
        apiGet<FinishedSku[]>("/api/finished-skus")
      ]);
      setMachines(machineData);
      setMachineSkus(machineSkuData);
      setSkus(skuData);
      setMachineSkuForm((prev) => ({
        ...prev,
        machineId: prev.machineId || machineData[0]?.id || "",
        skuId: prev.skuId || skuData[0]?.id || ""
      }));
    } catch (error: any) {
      push("error", error.message ?? "Failed to load machine data");
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

  function handleMachineEdit(machine: Machine) {
    setMachineEditingId(machine.id);
    setMachineForm({
      code: machine.code,
      name: machine.name,
      model: machine.model ?? "",
      category: machine.category ?? "",
      baseCapacityPerMinute: machine.baseCapacityPerMinute.toString(),
      active: machine.active
    });
  }

  function resetMachineForm() {
    setMachineEditingId(null);
    setMachineForm({ ...emptyMachineForm });
  }

  async function submitMachine(event: FormEvent) {
    event.preventDefault();
    const payload = {
      code: machineForm.code,
      name: machineForm.name,
      model: machineForm.model || undefined,
      category: machineForm.category || undefined,
      baseCapacityPerMinute: Number(machineForm.baseCapacityPerMinute),
      active: machineForm.active
    };

    try {
      if (machineEditingId) {
        await apiSend(`/api/machines/${machineEditingId}`, "PUT", payload);
        push("success", "Machine updated");
      } else {
        await apiSend("/api/machines", "POST", payload);
        push("success", "Machine created");
      }
      resetMachineForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save machine");
    }
  }

  function handleMachineSkuEdit(machineSku: MachineSku) {
    setMachineSkuEditingId(machineSku.id);
    setMachineSkuForm({
      machineId: machineSku.machineId,
      skuId: machineSku.skuId,
      capacityPerMinute: machineSku.capacityPerMinute.toString(),
      active: machineSku.active
    });
  }

  function resetMachineSkuForm() {
    setMachineSkuEditingId(null);
    setMachineSkuForm({
      ...emptyMachineSkuForm,
      machineId: machines[0]?.id ?? "",
      skuId: skus[0]?.id ?? ""
    });
  }

  async function submitMachineSku(event: FormEvent) {
    event.preventDefault();
    const payload = {
      machineId: machineSkuForm.machineId,
      skuId: machineSkuForm.skuId,
      capacityPerMinute: Number(machineSkuForm.capacityPerMinute),
      active: machineSkuForm.active
    };

    try {
      if (machineSkuEditingId) {
        await apiSend(`/api/machine-skus/${machineSkuEditingId}`, "PUT", payload);
        push("success", "Machine SKU updated");
      } else {
        await apiSend("/api/machine-skus", "POST", payload);
        push("success", "Machine SKU created");
      }
      resetMachineSkuForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save machine SKU");
    }
  }

  const filteredMachines = machines.filter((machine) => {
    const target = `${machine.code} ${machine.name}`.toLowerCase();
    return target.includes(machineSearch.toLowerCase());
  });

  const filteredMachineSkus = machineSkus.filter((item) => {
    const target = `${item.machine.code} ${item.sku.code} ${item.sku.name}`.toLowerCase();
    return target.includes(machineSkuSearch.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Machines & Machine SKUs"
        subtitle="Manage assets, base rates, and routing capacity in one place."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{machineEditingId ? "Edit Machine" : "Add Machine"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={submitMachine}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Machine Code"
                  value={machineForm.code}
                  onChange={(event) => setMachineForm({ ...machineForm, code: event.target.value })}
                  required
                />
                <Input
                  label="Machine Name"
                  value={machineForm.name}
                  onChange={(event) => setMachineForm({ ...machineForm, name: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Model"
                  value={machineForm.model}
                  onChange={(event) => setMachineForm({ ...machineForm, model: event.target.value })}
                />
                <Input
                  label="Category"
                  value={machineForm.category}
                  onChange={(event) => setMachineForm({ ...machineForm, category: event.target.value })}
                />
              </div>
              <Input
                label="Base Capacity (units/min)"
                value={machineForm.baseCapacityPerMinute}
                onChange={(event) => setMachineForm({ ...machineForm, baseCapacityPerMinute: event.target.value })}
                type="number"
                required
              />
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={machineForm.active}
                  onChange={(event) => setMachineForm({ ...machineForm, active: event.target.checked })}
                />
                Active
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">{machineEditingId ? "Save Changes" : "Create Machine"}</Button>
                {machineEditingId ? (
                  <Button type="button" variant="ghost" onClick={resetMachineForm}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Machines</CardTitle>
          </CardHeader>
          <CardBody>
            <Input
              label="Search"
              value={machineSearch}
              onChange={(event) => setMachineSearch(event.target.value)}
              placeholder="Search by code or name"
            />
            <div className="mt-6">
              <DataTable
                columns={[
                  { key: "code", label: "Code" },
                  { key: "name", label: "Machine" },
                  { key: "capacity", label: "Units/min", align: "right" },
                  { key: "actions", label: "" }
                ]}
                rows={filteredMachines.map((machine) => ({
                  code: machine.code,
                  name: machine.name,
                  capacity: machine.baseCapacityPerMinute,
                  actions: (
                    <Button variant="ghost" onClick={() => handleMachineEdit(machine)}>
                      Edit
                    </Button>
                  )
                }))}
                emptyLabel={loading ? "Loading machines..." : "No machines found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{machineSkuEditingId ? "Edit Machine SKU" : "Add Machine SKU"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={submitMachineSku}>
              <Select
                label="Machine"
                value={machineSkuForm.machineId}
                onChange={(event) => setMachineSkuForm({ ...machineSkuForm, machineId: event.target.value })}
                options={machineOptions}
                required
              />
              <Select
                label="Finished SKU"
                value={machineSkuForm.skuId}
                onChange={(event) => setMachineSkuForm({ ...machineSkuForm, skuId: event.target.value })}
                options={skuOptions}
                required
              />
              <Input
                label="Capacity (units/min)"
                value={machineSkuForm.capacityPerMinute}
                onChange={(event) => setMachineSkuForm({ ...machineSkuForm, capacityPerMinute: event.target.value })}
                type="number"
                required
              />
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={machineSkuForm.active}
                  onChange={(event) => setMachineSkuForm({ ...machineSkuForm, active: event.target.checked })}
                />
                Active
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">{machineSkuEditingId ? "Save Changes" : "Create Machine SKU"}</Button>
                {machineSkuEditingId ? (
                  <Button type="button" variant="ghost" onClick={resetMachineSkuForm}>
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
              value={machineSkuSearch}
              onChange={(event) => setMachineSkuSearch(event.target.value)}
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
                rows={filteredMachineSkus.map((item) => ({
                  machine: item.machine.name,
                  sku: item.sku.name,
                  capacity: item.capacityPerMinute,
                  actions: (
                    <Button variant="ghost" onClick={() => handleMachineSkuEdit(item)}>
                      Edit
                    </Button>
                  )
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
