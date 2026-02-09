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

type Vendor = { id: string; name: string; code: string; vendorType?: string | null };

type RawSku = {
  id: string;
  code: string;
  name: string;
  unit: string;
  scrapPct?: number | null;
  lowStockThreshold?: number | null;
  preferredVendorId?: string | null;
  preferredVendor?: Vendor | null;
  active: boolean;
};

const emptyForm = {
  code: "",
  name: "",
  unit: "",
  scrapPct: "",
  lowStockThreshold: "",
  preferredVendorId: "",
  active: true
};

export default function RawSkusPage() {
  const [skus, setSkus] = useState<RawSku[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [skuData, vendorData] = await Promise.all([
        apiGet<RawSku[]>("/api/raw-skus"),
        apiGet<Vendor[]>("/api/vendors")
      ]);
      setSkus(skuData);
      setVendors(vendorData);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load raw SKUs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vendorOptions = useMemo(() => {
    const rawVendors = vendors.filter((vendor) => (vendor.vendorType ?? "RAW") === "RAW");
    return [
      { value: "", label: "No preferred vendor" },
      ...rawVendors.map((vendor) => ({
        value: vendor.id,
        label: `${vendor.code} · ${vendor.name}`
      }))
    ];
  }, [vendors]);

  function handleEdit(sku: RawSku) {
    setEditingId(sku.id);
    setForm({
      code: sku.code,
      name: sku.name,
      unit: sku.unit,
      scrapPct: sku.scrapPct?.toString() ?? "",
      lowStockThreshold: sku.lowStockThreshold?.toString() ?? "",
      preferredVendorId: sku.preferredVendorId ?? "",
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
      scrapPct: Number(form.scrapPct),
      lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : undefined,
      preferredVendorId: form.preferredVendorId ? form.preferredVendorId : null,
      active: form.active
    };

    try {
      if (editingId) {
        await apiSend(`/api/raw-skus/${editingId}`, "PUT", payload);
        push("success", "Raw SKU updated");
      } else {
        await apiSend("/api/raw-skus", "POST", payload);
        push("success", "Raw SKU created");
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save raw SKU");
    }
  }

  const filtered = skus.filter((sku) => {
    const target = `${sku.code} ${sku.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Raw SKUs"
        subtitle="Define raw materials with units, scrap, and preferred suppliers."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Raw SKU" : "Add Raw SKU"}</CardTitle>
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
                  placeholder="KG, PCS, LTR"
                  required
                />
                <Input
                  label="Scrap %"
                  value={form.scrapPct}
                  onChange={(event) => setForm({ ...form, scrapPct: event.target.value })}
                  type="number"
                  required
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Low Stock Threshold"
                  value={form.lowStockThreshold}
                  onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })}
                  type="number"
                  placeholder="e.g. 50"
                />
              </div>
              <Select
                label="Preferred Vendor"
                value={form.preferredVendorId}
                onChange={(event) => setForm({ ...form, preferredVendorId: event.target.value })}
                options={vendorOptions}
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
                <Button type="submit">{editingId ? "Save Changes" : "Create Raw SKU"}</Button>
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
            <CardTitle>Raw SKUs</CardTitle>
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
                  { key: "name", label: "Material" },
                  { key: "unit", label: "Unit" },
                  { key: "threshold", label: "Low Stock" },
                  { key: "vendor", label: "Preferred Vendor" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((sku) => ({
                  code: sku.code,
                  name: sku.name,
                  unit: sku.unit,
                  threshold: sku.lowStockThreshold != null ? `${sku.lowStockThreshold} ${sku.unit}` : "—",
                  vendor: sku.preferredVendor ? sku.preferredVendor.name : "—",
                  actions: (
                    <Button variant="ghost" onClick={() => handleEdit(sku)}>
                      Edit
                    </Button>
                  )
                }))}
                emptyLabel={loading ? "Loading raw SKUs..." : "No raw SKUs found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
