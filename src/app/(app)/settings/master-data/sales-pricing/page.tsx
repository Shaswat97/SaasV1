"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type Customer = { id: string; code: string; name: string };
type FinishedSku = { id: string; code: string; name: string; unit: string; sellingPrice?: number | null };
type PriceListLine = {
  id?: string;
  skuId: string;
  unitPrice: number;
  discountPct?: number | null;
  taxPct?: number | null;
  minQty?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
  sku?: { id: string; code: string; name: string; unit: string };
};
type PriceList = {
  id: string;
  customerId: string;
  code?: string | null;
  name: string;
  notes?: string | null;
  active: boolean;
  customer: Customer;
  lines: PriceListLine[];
  updatedAt: string;
};

type LineForm = {
  skuId: string;
  unitPrice: string;
  discountPct: string;
  taxPct: string;
  minQty: string;
  effectiveFrom: string;
  effectiveTo: string;
  active: boolean;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function toInputDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function SalesPricingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [skus, setSkus] = useState<FinishedSku[]>([]);
  const [lists, setLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [lines, setLines] = useState<LineForm[]>([]);
  const [saving, setSaving] = useState(false);
  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [customerData, skuData, listData] = await Promise.all([
        apiGet<Customer[]>("/api/customers"),
        apiGet<FinishedSku[]>("/api/finished-skus"),
        apiGet<PriceList[]>("/api/sales-price-lists")
      ]);
      setCustomers(customerData);
      setSkus(skuData);
      setLists(listData);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load sales price lists");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })),
    [customers]
  );
  const skuOptions = useMemo(
    () => skus.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
    [skus]
  );
  const skuMap = useMemo(() => new Map(skus.map((sku) => [sku.id, sku])), [skus]);

  function resetForm() {
    setEditingId(null);
    setCustomerId(customers[0]?.id ?? "");
    setCode("");
    setName("");
    setNotes("");
    setActive(true);
    setLines([
      {
        skuId: skus[0]?.id ?? "",
        unitPrice: "",
        discountPct: "0",
        taxPct: "0",
        minQty: "",
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: "",
        active: true
      }
    ]);
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(list: PriceList) {
    setEditingId(list.id);
    setCustomerId(list.customerId);
    setCode(list.code ?? "");
    setName(list.name);
    setNotes(list.notes ?? "");
    setActive(list.active);
    setLines(
      list.lines.length
        ? list.lines.map((line) => ({
            skuId: line.skuId,
            unitPrice: String(line.unitPrice),
            discountPct: String(line.discountPct ?? 0),
            taxPct: String(line.taxPct ?? 0),
            minQty: line.minQty != null ? String(line.minQty) : "",
            effectiveFrom: toInputDate(line.effectiveFrom),
            effectiveTo: toInputDate(line.effectiveTo ?? null),
            active: line.active
          }))
        : [
            {
              skuId: skus[0]?.id ?? "",
              unitPrice: "",
              discountPct: "0",
              taxPct: "0",
              minQty: "",
              effectiveFrom: new Date().toISOString().slice(0, 10),
              effectiveTo: "",
              active: true
            }
          ]
    );
    setModalOpen(true);
  }

  function addLine() {
    if (!skus.length) {
      push("error", "Add finished SKUs first");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        skuId: skus[0].id,
        unitPrice: "",
        discountPct: "0",
        taxPct: "0",
        minQty: "",
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: "",
        active: true
      }
    ]);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!customerId) return push("error", "Customer is required");
    if (!name.trim()) return push("error", "Price list name is required");
    if (!lines.length) return push("error", "Add at least one price line");

    const payloadLines = lines.map((line) => ({
      skuId: line.skuId,
      unitPrice: Number(line.unitPrice),
      discountPct: Number(line.discountPct || 0),
      taxPct: Number(line.taxPct || 0),
      minQty: line.minQty ? Number(line.minQty) : undefined,
      effectiveFrom: new Date(`${line.effectiveFrom}T00:00:00`).toISOString(),
      effectiveTo: line.effectiveTo ? new Date(`${line.effectiveTo}T23:59:59.999`).toISOString() : undefined,
      active: line.active
    }));

    if (
      payloadLines.some(
        (line) =>
          !line.skuId ||
          !Number.isFinite(line.unitPrice) ||
          line.unitPrice <= 0 ||
          !line.effectiveFrom ||
          (line.minQty != null && (!Number.isFinite(line.minQty) || line.minQty <= 0))
      )
    ) {
      return push("error", "Each line needs SKU, valid price, and effective from date");
    }

    try {
      setSaving(true);
      const payload = {
        customerId,
        code: code.trim() || undefined,
        name: name.trim(),
        notes: notes.trim() || undefined,
        active,
        lines: payloadLines
      };
      if (editingId) {
        await apiSend(`/api/sales-price-lists/${editingId}`, "PUT", payload);
        push("success", "Price list updated");
      } else {
        await apiSend("/api/sales-price-lists", "POST", payload);
        push("success", "Price list created");
      }
      setModalOpen(false);
      await loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save price list");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiSend(`/api/sales-price-lists/${id}`, "DELETE", {});
      push("success", "Price list deleted");
      await loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to delete price list");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Sales Price Lists"
        subtitle="Customer-wise sales pricing with effective dates and optional quantity breaks."
        actions={<Button onClick={openCreate}>New Price List</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Configured Price Lists</CardTitle>
        </CardHeader>
        <CardBody>
          <DataTable
            columns={[
              { key: "name", label: "Price List" },
              { key: "customer", label: "Customer" },
              { key: "lines", label: "Active Lines", align: "right" as const },
              { key: "status", label: "Status" },
              { key: "updated", label: "Updated" },
              { key: "actions", label: "" }
            ]}
            rows={lists.map((list) => ({
              name: (
                <div className="flex flex-col">
                  <span className="font-semibold text-text">{list.name}</span>
                  <span className="text-xs text-text-muted">{list.code || "No code"}</span>
                </div>
              ),
              customer: `${list.customer.code} · ${list.customer.name}`,
              lines: String(list.lines.filter((line) => line.active).length),
              status: (
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${list.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}
                >
                  {list.active ? "Active" : "Inactive"}
                </span>
              ),
              updated: new Date(list.updatedAt).toLocaleDateString("en-IN"),
              actions: (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => openEdit(list)}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => handleDelete(list.id)}>
                    Delete
                  </Button>
                </div>
              )
            }))}
            emptyLabel={loading ? "Loading price lists..." : "No sales price lists configured."}
          />
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Sales Price List" : "New Sales Price List"}
        className="max-w-6xl"
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} options={customerOptions} />
            <Input label="Price List Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PL-ORION-2026" />
            <label className="flex items-center gap-2 text-sm text-text-muted pt-7">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
          </div>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commercial terms / coverage notes" />

          <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text">Price Lines</p>
              <Button type="button" variant="ghost" onClick={addLine}>
                Add Line
              </Button>
            </div>
            {lines.map((line, index) => {
              const sku = skuMap.get(line.skuId);
              return (
                <div key={`${line.skuId}-${index}`} className="rounded-xl border border-border/60 bg-surface/70 p-3 space-y-3">
                  <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
                    <Select
                      label="Finished SKU"
                      value={line.skuId}
                      onChange={(e) =>
                        setLines((prev) => prev.map((row, idx) => (idx === index ? { ...row, skuId: e.target.value } : row)))
                      }
                      options={skuOptions}
                    />
                    <Input
                      label="Unit Price (INR)"
                      type="number"
                      value={line.unitPrice}
                      onChange={(e) =>
                        setLines((prev) => prev.map((row, idx) => (idx === index ? { ...row, unitPrice: e.target.value } : row)))
                      }
                      hint={sku?.sellingPrice ? `SKU selling price: ${currency.format(sku.sellingPrice)}` : undefined}
                      required
                    />
                    <Input
                      label="Min Qty (optional)"
                      type="number"
                      value={line.minQty}
                      onChange={(e) =>
                        setLines((prev) => prev.map((row, idx) => (idx === index ? { ...row, minQty: e.target.value } : row)))
                      }
                      hint="Leave blank for default price."
                    />
                    <label className="flex items-center gap-2 text-sm text-text-muted pt-7">
                      <input
                        type="checkbox"
                        checked={line.active}
                        onChange={(e) =>
                          setLines((prev) => prev.map((row, idx) => (idx === index ? { ...row, active: e.target.checked } : row)))
                        }
                      />
                      Active
                    </label>
                    <Input
                      label="Discount %"
                      type="number"
                      value={line.discountPct}
                      onChange={(e) =>
                        setLines((prev) => prev.map((row, idx) => (idx === index ? { ...row, discountPct: e.target.value } : row)))
                      }
                    />
                    <Input
                      label="Tax %"
                      type="number"
                      value={line.taxPct}
                      onChange={(e) =>
                        setLines((prev) => prev.map((row, idx) => (idx === index ? { ...row, taxPct: e.target.value } : row)))
                      }
                    />
                    <Input
                      label="Effective From"
                      type="date"
                      value={line.effectiveFrom}
                      onChange={(e) =>
                        setLines((prev) => prev.map((row, idx) => (idx === index ? { ...row, effectiveFrom: e.target.value } : row)))
                      }
                      required
                    />
                    <Input
                      label="Effective To (optional)"
                      type="date"
                      value={line.effectiveTo}
                      onChange={(e) =>
                        setLines((prev) => prev.map((row, idx) => (idx === index ? { ...row, effectiveTo: e.target.value } : row)))
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== index))}
                      disabled={lines.length === 1}
                    >
                      Remove Line
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Price List" : "Create Price List"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

