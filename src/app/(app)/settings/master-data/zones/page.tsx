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

type Warehouse = { id: string; code: string; name: string };

type Zone = {
  id: string;
  code: string;
  name: string;
  type: "RAW_MATERIAL" | "PROCESSING_WIP" | "FINISHED" | "SCRAP" | "IN_TRANSIT" | "OTHER";
  warehouseId: string;
  warehouse: Warehouse;
  active: boolean;
};

const emptyForm = {
  code: "",
  name: "",
  type: "RAW_MATERIAL",
  warehouseId: "",
  active: true
};

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [zoneData, warehouseData] = await Promise.all([
        apiGet<Zone[]>("/api/zones"),
        apiGet<Warehouse[]>("/api/warehouses")
      ]);
      setZones(zoneData);
      setWarehouses(warehouseData);
      if (!form.warehouseId && warehouseData[0]) {
        setForm((prev) => ({ ...prev, warehouseId: warehouseData[0].id }));
      }
    } catch (error: any) {
      push("error", error.message ?? "Failed to load zones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const warehouseOptions = useMemo(
    () => warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.code} · ${warehouse.name}` })),
    [warehouses]
  );

  function handleEdit(zone: Zone) {
    setEditingId(zone.id);
    setForm({
      code: zone.code,
      name: zone.name,
      type: zone.type,
      warehouseId: zone.warehouseId,
      active: zone.active
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, warehouseId: warehouses[0]?.id ?? "" });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      code: form.code,
      name: form.name,
      type: form.type,
      warehouseId: form.warehouseId,
      active: form.active
    };

    try {
      if (editingId) {
        await apiSend(`/api/zones/${editingId}`, "PUT", payload);
        push("success", "Zone updated");
      } else {
        await apiSend("/api/zones", "POST", payload);
        push("success", "Zone created");
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save zone");
    }
  }

  const filtered = zones.filter((zone) => {
    const target = `${zone.code} ${zone.name} ${zone.warehouse?.name ?? ""}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader title="Zones" subtitle="Operational zones within each warehouse." />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Zone" : "Add Zone"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Zone Code"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  required
                />
                <Input
                  label="Zone Name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>
              <Select
                label="Warehouse"
                value={form.warehouseId}
                onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}
                options={warehouseOptions}
                required
              />
              <Select
                label="Zone Type"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                options={[
                  { value: "RAW_MATERIAL", label: "Raw Material" },
                  { value: "PROCESSING_WIP", label: "Processing / WIP" },
                  { value: "FINISHED", label: "Finished Goods" },
                  { value: "SCRAP", label: "Scrap" },
                  { value: "IN_TRANSIT", label: "In Transit" },
                  { value: "OTHER", label: "Other" }
                ]}
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
                <Button type="submit">{editingId ? "Save Changes" : "Create Zone"}</Button>
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
            <CardTitle>Zones</CardTitle>
          </CardHeader>
          <CardBody>
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by zone or warehouse"
            />
            <div className="mt-6">
              <DataTable
                columns={[
                  { key: "code", label: "Code" },
                  { key: "name", label: "Zone" },
                  { key: "warehouse", label: "Warehouse" },
                  { key: "type", label: "Type" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((zone) => ({
                  code: zone.code,
                  name: zone.name,
                  warehouse: zone.warehouse?.name ?? "—",
                  type: zone.type.replace(/_/g, " "),
                  actions: (
                    <Button variant="ghost" onClick={() => handleEdit(zone)}>
                      Edit
                    </Button>
                  )
                }))}
                emptyLabel={loading ? "Loading zones..." : "No zones found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
