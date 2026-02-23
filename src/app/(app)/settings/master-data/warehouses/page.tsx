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

type Warehouse = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

const emptyForm = {
  code: "",
  name: "",
  active: true
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toasts, push, remove } = useToast();

  async function loadWarehouses() {
    setLoading(true);
    try {
      const data = await apiGet<Warehouse[]>("/api/warehouses");
      setWarehouses(data);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEdit(warehouse: Warehouse) {
    setEditingId(warehouse.id);
    setForm({
      code: warehouse.code,
      name: warehouse.name,
      active: warehouse.active
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
      active: form.active
    };

    try {
      if (editingId) {
        await apiSend(`/api/warehouses/${editingId}`, "PUT", payload);
        push("success", "Warehouse updated");
      } else {
        await apiSend("/api/warehouses", "POST", payload);
        push("success", "Warehouse created");
      }
      resetForm();
      loadWarehouses();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save warehouse");
    }
  }

  const filtered = warehouses.filter((warehouse) => {
    const target = `${warehouse.code} ${warehouse.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader title="Warehouses" subtitle="Primary storage sites for inventory tracking." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Warehouse" : "Add Warehouse"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Warehouse Code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                required
              />
              <Input
                label="Warehouse Name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
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
                <Button type="submit">{editingId ? "Save Changes" : "Create Warehouse"}</Button>
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
            <CardTitle>Warehouses</CardTitle>
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
                  { key: "name", label: "Warehouse" },
                  { key: "status", label: "Status" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((warehouse) => ({
                  code: warehouse.code,
                  name: warehouse.name,
                  status: warehouse.active ? "Active" : "Inactive",
                  actions: (
                    <Button variant="ghost" onClick={() => handleEdit(warehouse)}>
                      Edit
                    </Button>
                  )
                }))}
                emptyLabel={loading ? "Loading warehouses..." : "No warehouses found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
