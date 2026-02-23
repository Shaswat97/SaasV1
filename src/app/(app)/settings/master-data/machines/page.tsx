"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
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

const emptyForm = {
  code: "",
  name: "",
  model: "",
  category: "",
  baseCapacityPerMinute: "",
  active: true
};

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toasts, push, remove } = useToast();

  async function loadMachines() {
    setLoading(true);
    try {
      const data = await apiGet<Machine[]>("/api/machines");
      setMachines(data);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load machines");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMachines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEdit(machine: Machine) {
    setEditingId(machine.id);
    setForm({
      code: machine.code,
      name: machine.name,
      model: machine.model ?? "",
      category: machine.category ?? "",
      baseCapacityPerMinute: machine.baseCapacityPerMinute.toString(),
      active: machine.active
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
      model: form.model || undefined,
      category: form.category || undefined,
      baseCapacityPerMinute: Number(form.baseCapacityPerMinute),
      active: form.active
    };

    try {
      if (editingId) {
        await apiSend(`/api/machines/${editingId}`, "PUT", payload);
        push("success", "Machine updated");
      } else {
        await apiSend("/api/machines", "POST", payload);
        push("success", "Machine created");
      }
      resetForm();
      loadMachines();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save machine");
    }
  }

  const filtered = machines.filter((machine) => {
    const target = `${machine.code} ${machine.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Machines"
        subtitle="Register assets, categories, and base throughput rates."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Machine" : "Add Machine"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Machine Code"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  required
                />
                <Input
                  label="Machine Name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Model"
                  value={form.model}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                />
                <Input
                  label="Category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                />
              </div>
              <Input
                label="Base Capacity (units/min)"
                value={form.baseCapacityPerMinute}
                onChange={(event) => setForm({ ...form, baseCapacityPerMinute: event.target.value })}
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
                <Button type="submit">{editingId ? "Save Changes" : "Create Machine"}</Button>
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
            <CardTitle>Machines</CardTitle>
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
                  { key: "name", label: "Machine" },
                  { key: "capacity", label: "Units/min", align: "right" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((machine) => ({
                  code: machine.code,
                  name: machine.name,
                  capacity: machine.baseCapacityPerMinute,
                  actions: (
                    <Button variant="ghost" onClick={() => handleEdit(machine)}>
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
    </div>
  );
}
