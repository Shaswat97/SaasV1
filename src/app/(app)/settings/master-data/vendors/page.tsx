"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { Select, type SelectOption } from "@/components/Select";
import { SectionHeader } from "@/components/SectionHeader";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type Vendor = {
  id: string;
  code: string;
  name: string;
  vendorType?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  billingLine1?: string | null;
  billingLine2?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  creditDays?: number | null;
  remindBeforeDays?: number | null;
  active: boolean;
  _count?: { vendorSkus: number };
};

type Sku = {
  id: string;
  code: string;
  name: string;
  unit: string;
  type: string;
};

type VendorSku = {
  id: string;
  vendorId: string;
  skuId: string;
  lastPrice?: number | null;
  sku: Sku;
};

const emptyForm = {
  code: "",
  name: "",
  vendorType: "RAW",
  phone: "",
  email: "",
  gstin: "",
  billingLine1: "",
  billingLine2: "",
  billingCity: "",
  billingState: "",
  billingPostalCode: "",
  billingCountry: "",
  shippingLine1: "",
  shippingLine2: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: "",
  creditDays: "0",
  remindBeforeDays: "3",
  active: true
};

function buildAddress(fields: typeof emptyForm, prefix: "billing" | "shipping") {
  return {
    line1: fields[`${prefix}Line1` as keyof typeof emptyForm] || undefined,
    line2: fields[`${prefix}Line2` as keyof typeof emptyForm] || undefined,
    city: fields[`${prefix}City` as keyof typeof emptyForm] || undefined,
    state: fields[`${prefix}State` as keyof typeof emptyForm] || undefined,
    postalCode: fields[`${prefix}PostalCode` as keyof typeof emptyForm] || undefined,
    country: fields[`${prefix}Country` as keyof typeof emptyForm] || undefined
  };
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vendorSkus, setVendorSkus] = useState<VendorSku[]>([]);
  const [skuCatalog, setSkuCatalog] = useState<Sku[]>([]);
  const [linkSkuId, setLinkSkuId] = useState("");
  const [linkPrice, setLinkPrice] = useState("");
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [isTechno, setIsTechno] = useState(false);
  const { toasts, push, remove } = useToast();

  async function loadVendors() {
    setLoading(true);
    try {
      const [data, user] = await Promise.all([
        apiGet<Vendor[]>("/api/vendors"),
        apiGet<{ actorEmployeeCode: string | null }>("/api/active-user")
      ]);
      setVendors(data);
      setIsTechno(user.actorEmployeeCode === "Techno");
    } catch (error: any) {
      push("error", error.message ?? "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editingId) {
      setVendorSkus([]);
      setSkuCatalog([]);
      setLinkSkuId("");
      setLinkPrice("");
      setPriceEdits({});
      return;
    }

    const vendorType = form.vendorType || vendors.find((vendor) => vendor.id === editingId)?.vendorType || "RAW";
    if (vendorType === "SCRAP") {
      setVendorSkus([]);
      setSkuCatalog([]);
      setLinkSkuId("");
      setLinkPrice("");
      setPriceEdits({});
      return;
    }

    async function loadVendorLinks() {
      try {
        const [links, skuData] = await Promise.all([
          apiGet<VendorSku[]>(`/api/vendor-skus?vendorId=${editingId}`),
          apiGet<Sku[]>(vendorType === "SUBCONTRACT" ? "/api/finished-skus" : "/api/raw-skus")
        ]);
        setVendorSkus(links);
        setSkuCatalog(skuData);
        setPriceEdits(
          links.reduce<Record<string, string>>((acc, link) => {
            acc[link.id] = link.lastPrice != null ? String(link.lastPrice) : "";
            return acc;
          }, {})
        );
        const linked = new Set(links.map((link) => link.skuId));
        const available = skuData.filter((sku) => !linked.has(sku.id));
        setLinkSkuId(available[0]?.id ?? skuData[0]?.id ?? "");
      } catch (error: any) {
        push("error", error.message ?? "Failed to load vendor SKUs");
      }
    }

    loadVendorLinks();
  }, [editingId, form.vendorType, vendors, push]);

  function handleEdit(vendor: Vendor) {
    setEditingId(vendor.id);
    setForm({
      code: vendor.code,
      name: vendor.name,
      phone: vendor.phone ?? "",
      email: vendor.email ?? "",
      gstin: vendor.gstin ?? "",
      billingLine1: vendor.billingLine1 ?? "",
      billingLine2: vendor.billingLine2 ?? "",
      billingCity: vendor.billingCity ?? "",
      billingState: vendor.billingState ?? "",
      billingPostalCode: vendor.billingPostalCode ?? "",
      billingCountry: vendor.billingCountry ?? "",
      shippingLine1: vendor.shippingLine1 ?? "",
      shippingLine2: vendor.shippingLine2 ?? "",
      shippingCity: vendor.shippingCity ?? "",
      shippingState: vendor.shippingState ?? "",
      shippingPostalCode: vendor.shippingPostalCode ?? "",
      shippingCountry: vendor.shippingCountry ?? "",
      creditDays: vendor.creditDays != null ? String(vendor.creditDays) : "0",
      remindBeforeDays: vendor.remindBeforeDays != null ? String(vendor.remindBeforeDays) : "3",
      vendorType: vendor.vendorType ?? "RAW",
      active: vendor.active
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function handleLinkSku() {
    if (!editingId) return;
    const vendorType = form.vendorType || "RAW";
    if (vendorType === "SCRAP") {
      push("error", "Scrap buyers do not require SKU linking.");
      return;
    }
    if (!linkSkuId) {
      push("error", "Select a SKU to link");
      return;
    }
    try {
      await apiSend("/api/vendor-skus", "POST", {
        vendorId: editingId,
        skuId: linkSkuId,
        lastPrice: linkPrice ? Number(linkPrice) : undefined
      });
      push("success", "Vendor SKU linked");
      setLinkPrice("");
      await loadVendors();
      const [links, skuData] = await Promise.all([
        apiGet<VendorSku[]>(`/api/vendor-skus?vendorId=${editingId}`),
        apiGet<Sku[]>(vendorType === "SUBCONTRACT" ? "/api/finished-skus" : "/api/raw-skus")
      ]);
      setVendorSkus(links);
      setSkuCatalog(skuData);
      setPriceEdits(
        links.reduce<Record<string, string>>((acc, link) => {
          acc[link.id] = link.lastPrice != null ? String(link.lastPrice) : "";
          return acc;
        }, {})
      );
      const linked = new Set(links.map((link) => link.skuId));
      const available = skuData.filter((sku) => !linked.has(sku.id));
      setLinkSkuId(available[0]?.id ?? skuData[0]?.id ?? "");
    } catch (error: any) {
      push("error", error.message ?? "Failed to link SKU");
    }
  }

  async function handleUpdatePrice(mapping: VendorSku) {
    try {
      await apiSend(`/api/vendor-skus/${mapping.id}`, "PUT", {
        lastPrice: priceEdits[mapping.id] ? Number(priceEdits[mapping.id]) : undefined
      });
      push("success", "Vendor price updated");
      const links = await apiGet<VendorSku[]>(`/api/vendor-skus?vendorId=${mapping.vendorId}`);
      setVendorSkus(links);
      setPriceEdits(
        links.reduce<Record<string, string>>((acc, link) => {
          acc[link.id] = link.lastPrice != null ? String(link.lastPrice) : "";
          return acc;
        }, {})
      );
    } catch (error: any) {
      push("error", error.message ?? "Failed to update price");
    }
  }

  async function handleRemoveLink(mapping: VendorSku) {
    if (!window.confirm(`Remove ${mapping.sku.code} · ${mapping.sku.name} from this vendor?`)) {
      return;
    }
    try {
      await apiSend(`/api/vendor-skus/${mapping.id}`, "DELETE");
      push("success", "Vendor SKU removed");
      await loadVendors();
      const links = await apiGet<VendorSku[]>(`/api/vendor-skus?vendorId=${mapping.vendorId}`);
      setVendorSkus(links);
      setPriceEdits(
        links.reduce<Record<string, string>>((acc, link) => {
          acc[link.id] = link.lastPrice != null ? String(link.lastPrice) : "";
          return acc;
        }, {})
      );
      const linked = new Set(links.map((link) => link.skuId));
      const available = skuCatalog.filter((sku) => !linked.has(sku.id));
      setLinkSkuId(available[0]?.id ?? skuCatalog[0]?.id ?? "");
    } catch (error: any) {
      push("error", error.message ?? "Failed to remove vendor SKU");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      code: form.code,
      name: form.name,
      vendorType: form.vendorType || "RAW",
      phone: form.phone || undefined,
      email: form.email || undefined,
      gstin: form.gstin || undefined,
      creditDays: form.creditDays ? Number(form.creditDays) : undefined,
      remindBeforeDays: form.remindBeforeDays ? Number(form.remindBeforeDays) : undefined,
      active: form.active,
      billingAddress: buildAddress(form, "billing"),
      shippingAddress: buildAddress(form, "shipping")
    };

    try {
      if (editingId) {
        await apiSend(`/api/vendors/${editingId}`, "PUT", payload);
        push("success", "Vendor updated");
      } else {
        await apiSend("/api/vendors", "POST", payload);
        push("success", "Vendor created");
      }
      resetForm();
      loadVendors();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save vendor");
    }
  }

  const filtered = vendors.filter((vendor) => {
    const target = `${vendor.code} ${vendor.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  const availableSkuOptions: SelectOption[] = skuCatalog
    .filter((sku) => !vendorSkus.some((link) => link.skuId === sku.id))
    .map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name}` }));

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Vendors"
        subtitle="Raw suppliers, subcontractors, and scrap buyers."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit Vendor" : "Add Vendor"}</CardTitle>
            </CardHeader>
            <CardBody>
              {editingId ? (
                <p className="mb-4 text-xs uppercase tracking-[0.2em] text-text-muted">
                  {form.vendorType === "SCRAP"
                    ? "SKU linking not applicable for scrap buyers."
                    : `Linked ${form.vendorType === "SUBCONTRACT" ? "Finished" : "Raw"} SKUs: ${vendors.find((vendor) => vendor.id === editingId)?._count?.vendorSkus ?? 0
                    }`}
                </p>
              ) : null}
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Vendor Code"
                    value={form.code}
                    onChange={(event) => setForm({ ...form, code: event.target.value })}
                    required
                  />
                  <Input
                    label="Vendor Name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </div>
                <Select
                  label="Vendor Type"
                  value={form.vendorType}
                  onChange={(event) => setForm({ ...form, vendorType: event.target.value })}
                  options={[
                    { value: "RAW", label: "Raw Supplier" },
                    { value: "SUBCONTRACT", label: "Subcontractor" },
                    { value: "SCRAP", label: "Scrap Buyer" }
                  ]}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                  <Input
                    label="Email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    type="email"
                  />
                </div>
                <Input
                  label="GSTIN"
                  value={form.gstin}
                  onChange={(event) => setForm({ ...form, gstin: event.target.value })}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Credit Days"
                    type="number"
                    min="0"
                    value={form.creditDays}
                    onChange={(event) => setForm({ ...form, creditDays: event.target.value })}
                  />
                  <Input
                    label="Remind Before (days)"
                    type="number"
                    min="0"
                    value={form.remindBeforeDays}
                    onChange={(event) => setForm({ ...form, remindBeforeDays: event.target.value })}
                  />
                </div>

                <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Billing Address</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <Input
                      label="Line 1"
                      value={form.billingLine1}
                      onChange={(event) => setForm({ ...form, billingLine1: event.target.value })}
                    />
                    <Input
                      label="Line 2"
                      value={form.billingLine2}
                      onChange={(event) => setForm({ ...form, billingLine2: event.target.value })}
                    />
                    <Input
                      label="City"
                      value={form.billingCity}
                      onChange={(event) => setForm({ ...form, billingCity: event.target.value })}
                    />
                    <Input
                      label="State"
                      value={form.billingState}
                      onChange={(event) => setForm({ ...form, billingState: event.target.value })}
                    />
                    <Input
                      label="Postal Code"
                      value={form.billingPostalCode}
                      onChange={(event) => setForm({ ...form, billingPostalCode: event.target.value })}
                    />
                    <Input
                      label="Country"
                      value={form.billingCountry}
                      onChange={(event) => setForm({ ...form, billingCountry: event.target.value })}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Shipping Address</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <Input
                      label="Line 1"
                      value={form.shippingLine1}
                      onChange={(event) => setForm({ ...form, shippingLine1: event.target.value })}
                    />
                    <Input
                      label="Line 2"
                      value={form.shippingLine2}
                      onChange={(event) => setForm({ ...form, shippingLine2: event.target.value })}
                    />
                    <Input
                      label="City"
                      value={form.shippingCity}
                      onChange={(event) => setForm({ ...form, shippingCity: event.target.value })}
                    />
                    <Input
                      label="State"
                      value={form.shippingState}
                      onChange={(event) => setForm({ ...form, shippingState: event.target.value })}
                    />
                    <Input
                      label="Postal Code"
                      value={form.shippingPostalCode}
                      onChange={(event) => setForm({ ...form, shippingPostalCode: event.target.value })}
                    />
                    <Input
                      label="Country"
                      value={form.shippingCountry}
                      onChange={(event) => setForm({ ...form, shippingCountry: event.target.value })}
                    />
                  </div>
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
                  <Button type="submit">{editingId ? "Save Changes" : "Create Vendor"}</Button>
                  {editingId ? (
                    <Button type="button" variant="ghost" onClick={resetForm}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardBody>
          </Card>

          {editingId && form.vendorType !== "SCRAP" ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Linked {form.vendorType === "SUBCONTRACT" ? "Finished" : "Raw"} SKUs & Last Price
                </CardTitle>
              </CardHeader>
              <CardBody>
                {vendorSkus.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    No SKUs linked yet. Link at least one SKU to control purchasing options.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {vendorSkus.map((mapping) => (
                      <div
                        key={mapping.id}
                        className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-text">
                            {mapping.sku.code} · {mapping.sku.name}
                          </p>
                          <p className="text-xs text-text-muted">Unit: {mapping.sku.unit}</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="block space-y-2 text-sm">
                            <span className="text-text-muted">Last Price</span>
                            <input
                              className="focus-ring w-36 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm shadow-black/10 ring-1 ring-border/40 focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/30"
                              value={priceEdits[mapping.id] ?? ""}
                              type="number"
                              onChange={(event) =>
                                setPriceEdits((prev) => ({ ...prev, [mapping.id]: event.target.value }))
                              }
                            />
                          </label>
                          <Button type="button" variant="secondary" onClick={() => handleUpdatePrice(mapping)}>
                            Update
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => handleRemoveLink(mapping)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 space-y-3 rounded-2xl border border-dashed border-border/70 bg-white/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Link New SKU</p>
                  <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
                    <Select
                      label={form.vendorType === "SUBCONTRACT" ? "Finished SKU" : "Raw SKU"}
                      value={linkSkuId}
                      onChange={(event) => setLinkSkuId(event.target.value)}
                      options={availableSkuOptions}
                      hint={
                        availableSkuOptions.length
                          ? "Only unlinked SKUs are shown."
                          : "All SKUs are already linked."
                      }
                    />
                    <Input
                      label="Last Price"
                      value={linkPrice}
                      onChange={(event) => setLinkPrice(event.target.value)}
                      type="number"
                      hint="Optional. Used as default price in PO."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleLinkSku}
                    disabled={!availableSkuOptions.length}
                  >
                    Link SKU
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendors</CardTitle>
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
                  { key: "name", label: "Vendor" },
                  { key: "type", label: "Type" },
                  { key: "skus", label: "Linked SKUs", align: "right" },
                  { key: "status", label: "Status" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((vendor) => ({
                  code: vendor.code,
                  name: vendor.name,
                  type:
                    vendor.vendorType === "SUBCONTRACT"
                      ? "Subcontractor"
                      : vendor.vendorType === "SCRAP"
                        ? "Scrap Buyer"
                        : "Raw Supplier",
                  skus: vendor._count?.vendorSkus ?? 0,
                  status: vendor.active ? "Active" : "Inactive",
                  actions: isTechno ? (
                    <Button variant="ghost" onClick={() => handleEdit(vendor)}>
                      Edit
                    </Button>
                  ) : null
                }))}
                emptyLabel={loading ? "Loading vendors..." : "No vendors found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
