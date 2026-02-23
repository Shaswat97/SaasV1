"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { Tabs } from "@/components/Tabs";
import { ToastViewport } from "@/components/ToastViewport";
import { DateFilter, getPresetRange } from "@/components/DateFilter";
import type { DateRange } from "@/components/DateFilter";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type Vendor = { id: string; code: string; name: string; vendorType?: string | null };

type FinishedSku = { id: string; code: string; name: string; unit: string };

type VendorSku = { id: string; skuId: string; lastPrice?: number | null; sku: FinishedSku };

type Zone = { id: string; name: string; code: string; type: string };

type Allocation = {
  soLine?: {
    salesOrder?: { id: string; soNumber?: string | null; customer?: { name?: string | null } | null } | null;
  } | null;
};

type PurchaseOrderLine = {
  id: string;
  skuId: string;
  sku: FinishedSku;
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  taxPct?: number | null;
  expectedDate?: string | null;
  qcStatus?: string | null;
  qcNotes?: string | null;
  receivedQty: number;
  shortClosedQty?: number | null;
  allocations?: Allocation[];
};

type PurchaseOrder = {
  id: string;
  poNumber?: string | null;
  status: string;
  type?: string | null;
  deletedAt?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
  vendor: Vendor;
  vendorId: string;
  lines: PurchaseOrderLine[];
  receipts?: Array<{ id: string; receivedAt: string }>;
  orderDate: string;
  currency: string;
  notes?: string | null;
};

type DraftLineForm = {
  skuId: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  taxPct: string;
  expectedDate: string;
  qcStatus: string;
  qcNotes: string;
};

type ReceiveLineForm = {
  poLineId: string;
  sku: FinishedSku;
  openQty: number;
  qty: string;
};

type PageState = {
  draft: number;
  pending: number;
  approved: number;
  received: number;
  deleted: number;
};

const statusBadge: Record<string, { label: string; variant: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  PENDING: { label: "Pending", variant: "warning" },
  APPROVED: { label: "Approved", variant: "info" },
  RECEIVED: { label: "Received", variant: "success" },
  CLOSED: { label: "Closed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "danger" }
};

const qcOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "PASSED", label: "Passed" },
  { value: "FAILED", label: "Failed" }
];

const perPage = 5;

function lineNetTotal(line: { quantity: number; unitPrice: number; discountPct?: number | null; taxPct?: number | null }) {
  const discount = line.discountPct ?? 0;
  const tax = line.taxPct ?? 0;
  const discounted = line.unitPrice * (1 - discount / 100);
  return line.quantity * discounted * (1 + tax / 100);
}

function paginate<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page: safePage,
    totalPages
  };
}

function Pagination({
  page,
  totalPages,
  onChange
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-text-muted">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          Prev
        </Button>
        <Button variant="ghost" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}

function collectLinkedOrders(order: PurchaseOrder) {
  const map = new Map<string, { label: string; customer?: string | null }>();
  order.lines.forEach((line) => {
    line.allocations?.forEach((allocation) => {
      const so = allocation.soLine?.salesOrder;
      if (!so) return;
      const key = so.id;
      if (!map.has(key)) {
        map.set(key, { label: so.soNumber ?? so.id, customer: so.customer?.name ?? null });
      }
    });
  });
  return Array.from(map.values());
}

export default function SubcontractingPage() {
  const toLocalDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const today = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [finishedSkus, setFinishedSkus] = useState<FinishedSku[]>([]);
  const [vendorSkus, setVendorSkus] = useState<VendorSku[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [lines, setLines] = useState<DraftLineForm[]>([]);
  const [consolidate, setConsolidate] = useState(true);

  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLineForm[]>([]);
  const [receiveZoneId, setReceiveZoneId] = useState<string>("");
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const receiveRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [completedDateRange, setCompletedDateRange] = useState<DateRange>(() => getPresetRange("today"));
  const completedStart = toLocalDate(completedDateRange.from);
  const completedEnd = toLocalDate(completedDateRange.to);
  const [pages, setPages] = useState<PageState>({
    draft: 1,
    pending: 1,
    approved: 1,
    received: 1,
    deleted: 1
  });

  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [vendorData, skuData, zoneData, orderData] = await Promise.all([
        apiGet<Vendor[]>("/api/vendors"),
        apiGet<FinishedSku[]>("/api/finished-skus"),
        apiGet<Zone[]>("/api/zones"),
        apiGet<PurchaseOrder[]>("/api/purchase-orders?includeDeleted=true&includeAllocations=true")
      ]);
      setVendors(vendorData);
      setFinishedSkus(skuData);
      setZones(zoneData);
      setOrders(orderData);

      if (!vendorId) {
        const firstSub = vendorData.find((vendor) => (vendor.vendorType ?? "RAW") === "SUBCONTRACT");
        if (firstSub) setVendorId(firstSub.id);
      }

      const finishedZone = zoneData.find((zone) => zone.type === "FINISHED");
      if (!receiveZoneId && finishedZone) setReceiveZoneId(finishedZone.id);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load subcontracting data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vendorId) {
      setVendorSkus([]);
      return;
    }

    async function loadVendorSkus() {
      try {
        const data = await apiGet<VendorSku[]>(`/api/vendor-skus?vendorId=${vendorId}`);
        setVendorSkus(data);
      } catch (error: any) {
        push("error", error.message ?? "Failed to load subcontract vendor SKUs");
      }
    }

    loadVendorSkus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  useEffect(() => {
    setPages({ draft: 1, pending: 1, approved: 1, received: 1, deleted: 1 });
  }, [search, vendorFilter, completedStart, completedEnd, orders.length]);

  function resetForm() {
    setEditingId(null);
    setNotes("");
    setLines([]);
    setConsolidate(true);
  }

  function resetFilters() {
    setSearch("");
    setVendorFilter("ALL");
    setCompletedDateRange(getPresetRange("today"));
  }

  async function deleteOrder(order: PurchaseOrder) {
    if (!window.confirm(`Delete PO ${order.poNumber ?? order.id}? It will appear in Deleted tab.`)) {
      return;
    }
    try {
      await apiSend(`/api/purchase-orders/${order.id}`, "DELETE");
      push("success", "PO deleted");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to delete PO");
    }
  }

  function withinDateRange(value: string, start: string, end: string) {
    if (!value) return false;
    const dateValue = new Date(value);
    const startDate = start ? new Date(`${start}T00:00:00`) : null;
    const endDate = end ? new Date(`${end}T23:59:59.999`) : null;
    if (startDate && dateValue < startDate) return false;
    if (endDate && dateValue > endDate) return false;
    return true;
  }

  function latestReceiptDate(order: PurchaseOrder) {
    if (!order.receipts?.length) return null;
    return order.receipts.reduce((latest, receipt) => {
      return new Date(receipt.receivedAt) > new Date(latest) ? receipt.receivedAt : latest;
    }, order.receipts[0].receivedAt);
  }

  function latestReceipt(order: PurchaseOrder) {
    if (!order.receipts?.length) return null;
    return order.receipts.reduce((latest, receipt) => {
      return new Date(receipt.receivedAt) > new Date(latest.receivedAt) ? receipt : latest;
    }, order.receipts[0]);
  }

  function addLine() {
    if (!vendorSkus.length) {
      push("error", "Link finished SKUs to this subcontractor before creating a PO");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        skuId: vendorSkus[0].skuId,
        quantity: "",
        unitPrice: "",
        discountPct: "0",
        taxPct: "0",
        expectedDate: "",
        qcStatus: "PENDING",
        qcNotes: ""
      }
    ]);
  }

  function handleEdit(order: PurchaseOrder) {
    if (order.status !== "DRAFT" && order.status !== "PENDING") {
      push("error", "Only Draft or Pending orders can be edited");
      return;
    }
    setEditingId(order.id);
    setVendorId(order.vendorId);
    setNotes(order.notes ?? "");
    setLines(
      order.lines.map((line) => ({
        skuId: line.skuId,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        discountPct: String(line.discountPct ?? 0),
        taxPct: String(line.taxPct ?? 0),
        expectedDate: line.expectedDate ? line.expectedDate.slice(0, 10) : "",
        qcStatus: line.qcStatus ?? "PENDING",
        qcNotes: line.qcNotes ?? ""
      }))
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!vendorId) {
      push("error", "Subcontractor is required");
      return;
    }

    if (!vendorSkus.length) {
      push("error", "This subcontractor has no linked finished SKUs");
      return;
    }

    if (lines.length === 0) {
      push("error", "Add at least one line");
      return;
    }

    const payloadLines = lines.map((line) => ({
      skuId: line.skuId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      discountPct: Number(line.discountPct || 0),
      taxPct: Number(line.taxPct || 0),
      expectedDate: line.expectedDate ? new Date(line.expectedDate).toISOString() : undefined,
      qcStatus: line.qcStatus,
      qcNotes: line.qcNotes || undefined
    }));

    if (payloadLines.some((line) => !line.skuId || line.quantity <= 0 || line.unitPrice <= 0)) {
      push("error", "Each line needs a SKU, quantity > 0, and unit price > 0");
      return;
    }
    if (payloadLines.some((line) => !vendorSkus.find((mapping) => mapping.skuId === line.skuId))) {
      push("error", "One or more SKUs are not linked to this subcontractor");
      return;
    }

    try {
      if (editingId) {
        await apiSend(`/api/purchase-orders/${editingId}`, "PUT", {
          notes,
          lines: payloadLines
        });
        push("success", "Subcontract PO updated");
      } else {
        await apiSend("/api/purchase-orders", "POST", {
          vendorId,
          notes,
          consolidate,
          type: "SUBCONTRACT",
          lines: payloadLines
        });
        push("success", consolidate ? "Draft subcontract PO updated" : "Subcontract PO created");
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save subcontract PO");
    }
  }

  async function confirmOrder(orderId: string) {
    try {
      await apiSend(`/api/purchase-orders/${orderId}/confirm`, "POST");
      push("success", "Subcontract PO confirmed");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to confirm subcontract PO");
    }
  }

  async function approveOrder(orderId: string) {
    try {
      await apiSend(`/api/purchase-orders/${orderId}/approve`, "POST");
      push("success", "Subcontract PO approved");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to approve subcontract PO");
    }
  }

  async function closeOrder(order: PurchaseOrder) {
    if (!window.confirm(`Close PO ${order.poNumber ?? order.id}? Remaining quantities will be short closed.`)) {
      return;
    }
    try {
      await apiSend(`/api/purchase-orders/${order.id}/close`, "POST", {});
      push("success", "PO closed");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to close PO");
    }
  }

  function downloadReceipt(receiptId: string) {
    window.open(`/api/goods-receipts/${receiptId}/pdf`, "_blank");
  }

  function openReceive(order: PurchaseOrder) {
    if (order.status !== "APPROVED") {
      push("error", "Only approved orders can be received");
      return;
    }
    setLastReceiptId(null);
    setReceivePo(order);
    setReceiveLines(
      order.lines
        .map((line) => ({
          poLineId: line.id,
          sku: line.sku,
          openQty: Math.max(line.quantity - line.receivedQty, 0),
          qty: ""
        }))
        .filter((line) => line.openQty > 0)
    );
    if (!receiveZoneId || !finishedZoneOptions.some((zone) => zone.value === receiveZoneId)) {
      setReceiveZoneId(finishedZoneOptions[0]?.value ?? "");
    }
    setTimeout(() => {
      receiveRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }

  async function receiveOrder() {
    if (!receivePo) return;
    const payloadLines = receiveLines
      .filter((line) => Number(line.qty) > 0)
      .map((line) => ({ poLineId: line.poLineId, quantity: Number(line.qty) }));

    if (payloadLines.length === 0) {
      push("error", "Enter quantities to receive");
      return;
    }

    const invalid = receiveLines.some((line) => Number(line.qty) > line.openQty);
    if (invalid) {
      push("error", "Received quantity cannot exceed open quantity");
      return;
    }

    try {
      const result = await apiSend<{
        receiptId: string;
        fullyReceived: boolean;
        remainingLines: Array<{ skuCode: string; skuName: string; remainingQty: number; unit: string }>;
      }>(`/api/purchase-orders/${receivePo.id}/receive`, "POST", {
        zoneId: receiveZoneId || undefined,
        lines: payloadLines
      });
      setLastReceiptId(result.receiptId);

      if (result.fullyReceived) {
        push("success", "Receipt posted. Subcontract PO fully received.");
      } else {
        const first = result.remainingLines[0];
        if (first) {
          push(
            "info",
            `Receipt posted. Still pending ${first.remainingQty} ${first.unit} for ${first.skuCode}.`
          );
        } else {
          push("info", "Receipt posted. Lines still pending.");
        }
      }

      setReceivePo(null);
      setReceiveLines([]);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to receive subcontract PO");
    }
  }

  function filteredOrders(input: PurchaseOrder[]) {
    const term = search.trim().toLowerCase();
    return input.filter((order) => {
      const matchesVendor = vendorFilter === "ALL" || order.vendorId === vendorFilter;
      const matchesSearch =
        !term ||
        order.poNumber?.toLowerCase().includes(term) ||
        order.vendor.name.toLowerCase().includes(term) ||
        order.vendor.code.toLowerCase().includes(term);
      return matchesVendor && matchesSearch;
    });
  }

  const subcontractOrders = useMemo(
    () => orders.filter((order) => (order.type ?? "RAW") === "SUBCONTRACT"),
    [orders]
  );
  const activeOrders = useMemo(() => subcontractOrders.filter((order) => !order.deletedAt), [subcontractOrders]);
  const deletedOrders = useMemo(() => subcontractOrders.filter((order) => order.deletedAt), [subcontractOrders]);
  const draftOrders = useMemo(() => activeOrders.filter((order) => order.status === "DRAFT"), [activeOrders]);
  const pendingOrders = useMemo(() => activeOrders.filter((order) => order.status === "PENDING"), [activeOrders]);
  const approvedOrders = useMemo(() => activeOrders.filter((order) => order.status === "APPROVED"), [activeOrders]);
  const receivedOrders = useMemo(
    () => activeOrders.filter((order) => ["RECEIVED", "CLOSED"].includes(order.status)),
    [activeOrders]
  );

  const filteredDraft = useMemo(() => filteredOrders(draftOrders), [draftOrders, search, vendorFilter]);
  const filteredPending = useMemo(() => filteredOrders(pendingOrders), [pendingOrders, search, vendorFilter]);
  const filteredApproved = useMemo(() => filteredOrders(approvedOrders), [approvedOrders, search, vendorFilter]);
  const filteredReceived = useMemo(
    () =>
      filteredOrders(receivedOrders).filter((order) => {
        const receivedAt = latestReceiptDate(order) ?? order.closedAt ?? null;
        return receivedAt ? withinDateRange(receivedAt, completedStart, completedEnd) : false;
      }),
    [receivedOrders, search, vendorFilter, completedStart, completedEnd]
  );
  const filteredDeleted = useMemo(() => filteredOrders(deletedOrders), [deletedOrders, search, vendorFilter]);

  const pagedDraft = paginate(filteredDraft, pages.draft);
  const pagedPending = paginate(filteredPending, pages.pending);
  const pagedApproved = paginate(filteredApproved, pages.approved);
  const pagedReceived = paginate(filteredReceived, pages.received);
  const pagedDeleted = paginate(filteredDeleted, pages.deleted);

  const vendorOptions = useMemo(
    () =>
      vendors
        .filter((vendor) => (vendor.vendorType ?? "RAW") === "SUBCONTRACT")
        .map((vendor) => ({ value: vendor.id, label: `${vendor.code} · ${vendor.name}` })),
    [vendors]
  );

  const vendorFilterOptions = useMemo(
    () => [{ value: "ALL", label: "All Subcontractors" }, ...vendorOptions],
    [vendorOptions]
  );

  const vendorSkuMap = useMemo(() => new Map(vendorSkus.map((mapping) => [mapping.skuId, mapping])), [vendorSkus]);

  const skuOptions = useMemo(
    () => vendorSkus.map((mapping) => ({ value: mapping.skuId, label: `${mapping.sku.code} · ${mapping.sku.name}` })),
    [vendorSkus]
  );

  const finishedZoneOptions = useMemo(() => {
    const finished = zones.filter((zone) => zone.type === "FINISHED");
    return finished.map((zone) => ({ value: zone.id, label: `${zone.name} · ${zone.code}` }));
  }, [zones]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Subcontracting"
        subtitle="Manage subcontract production orders and receive finished goods into stock."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Subcontract PO" : "Create Subcontract PO"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Select
                label="Subcontractor"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
                options={vendorOptions}
                required
                disabled={Boolean(editingId)}
              />
              <Input
                label="Notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Delivery instructions, terms, or notes"
              />
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={consolidate}
                  onChange={(event) => setConsolidate(event.target.checked)}
                />
                Consolidate into subcontractor draft PO
              </label>

              <div className="space-y-3">
                {lines.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted">
                    Add subcontract lines to begin.
                  </div>
                ) : (
                  lines.map((line, index) => (
                    <div
                      key={`${line.skuId}-${index}`}
                      className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4"
                    >
                      <div className="grid gap-3 lg:grid-cols-2">
                        <Select
                          label="Finished SKU"
                          value={line.skuId}
                          onChange={(event) => {
                            const value = event.target.value;
                            const vendorPrice = vendorSkuMap.get(value)?.lastPrice ?? null;
                            setLines((prev) =>
                              prev.map((item, idx) => {
                                if (idx !== index) return item;
                                const shouldSetPrice = !item.unitPrice || Number(item.unitPrice) <= 0;
                                return {
                                  ...item,
                                  skuId: value,
                                  unitPrice: shouldSetPrice && vendorPrice != null ? String(vendorPrice) : item.unitPrice
                                };
                              })
                            );
                          }}
                          options={
                            vendorSkuMap.has(line.skuId)
                              ? skuOptions
                              : (() => {
                                  const fallback = finishedSkus.find((sku) => sku.id === line.skuId);
                                  if (!fallback) return skuOptions;
                                  return [
                                    { value: fallback.id, label: `UNLINKED · ${fallback.code} · ${fallback.name}` },
                                    ...skuOptions
                                  ];
                                })()
                          }
                          hint={vendorSkus.length ? "Only linked SKUs are shown." : "Link SKUs to this vendor first."}
                        />
                        <Input
                          label="Quantity"
                          value={line.quantity}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, quantity: value } : item))
                            );
                          }}
                          type="number"
                          required
                        />
                        <Input
                          label="Unit Price"
                          value={line.unitPrice}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, unitPrice: value } : item))
                            );
                          }}
                          type="number"
                          required
                          hint={(() => {
                            const mapping = vendorSkuMap.get(line.skuId);
                            if (!mapping || mapping.lastPrice == null) return "No vendor price on record.";
                            const current = Number(line.unitPrice);
                            const diff = Number.isFinite(current) && current > 0 ? current - mapping.lastPrice : null;
                            const diffLabel =
                              diff == null
                                ? ""
                                : ` · Δ ${diff >= 0 ? "+" : ""}${diff.toFixed(2).replace(/\\.00$/, "")}`;
                            return `Vendor last price: ₹${mapping.lastPrice.toFixed(2).replace(/\\.00$/, "")}${diffLabel}`;
                          })()}
                        />
                        <Input
                          label="Expected Date"
                          value={line.expectedDate}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, expectedDate: value } : item))
                            );
                          }}
                          type="date"
                        />
                        <Input
                          label="Discount %"
                          value={line.discountPct}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, discountPct: value } : item))
                            );
                          }}
                          type="number"
                        />
                        <Input
                          label="Tax %"
                          value={line.taxPct}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, taxPct: value } : item))
                            );
                          }}
                          type="number"
                        />
                        <Select
                          label="QC Status"
                          value={line.qcStatus}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, qcStatus: value } : item))
                            );
                          }}
                          options={qcOptions}
                        />
                        <Input
                          label="QC Notes"
                          value={line.qcNotes}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, qcNotes: value } : item))
                            );
                          }}
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== index))}
                        >
                          Remove line
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={addLine}>
                  Add Line
                </Button>
                <Button type="submit">{editingId ? "Save Changes" : "Create Draft PO"}</Button>
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="PO number or subcontractor"
                />
                <Select
                  label="Subcontractor"
                  value={vendorFilter}
                  onChange={(event) => setVendorFilter(event.target.value)}
                  options={vendorFilterOptions}
                />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-text-muted">Completed PO Date Range</label>
                  <DateFilter
                    value={completedDateRange}
                    onChange={(range) => setCompletedDateRange(range)}
                    defaultPreset="today"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-text-muted">Date range applies to the Completed tab.</p>
              <div className="mt-4">
                <Button variant="ghost" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subcontract Orders</CardTitle>
            </CardHeader>
            <CardBody>
              <Tabs
                items={[
                  {
                    label: `Drafts (${filteredDraft.length})`,
                    value: "drafts",
                    content: (
                      <>
                        <DataTable
                          columns={[
                            { key: "po", label: "PO" },
                            { key: "vendor", label: "Subcontractor" },
                            { key: "linked", label: "Linked Sales Orders" },
                            { key: "items", label: "Line Items" },
                            { key: "lines", label: "Lines", align: "right" },
                            { key: "status", label: "Status" },
                            { key: "actions", label: "" }
                          ]}
                          rows={pagedDraft.items.map((order) => {
                            const linked = collectLinkedOrders(order);
                            return {
                              po: order.poNumber ?? "—",
                              vendor: order.vendor.name,
                              linked: linked.length ? (
                                <div className="space-y-1 text-xs text-text-muted">
                                  {linked.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                      <span className="text-text">{item.label}</span>
                                      <span>{item.customer ?? ""}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "Manual"
                              ),
                              items: order.lines.length ? (
                                <div className="space-y-1 text-xs text-text-muted">
                                  {order.lines.map((line) => (
                                    <div key={line.id} className="flex items-center justify-between gap-3">
                                      <span className="text-text">
                                        {line.sku.code} · {line.sku.name}
                                      </span>
                                      <span>
                                        {line.quantity} {line.sku.unit}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "—"
                              ),
                              lines: order.lines.length,
                              status: <Badge {...statusBadge[order.status]} />,
                              actions: (
                                <div className="flex gap-2">
                                  <Button variant="ghost" onClick={() => handleEdit(order)}>
                                    Edit
                                  </Button>
                                  <Button variant="ghost" onClick={() => deleteOrder(order)}>
                                    Delete
                                  </Button>
                                  <Button variant="ghost" onClick={() => confirmOrder(order.id)}>
                                    Confirm
                                  </Button>
                                </div>
                              )
                            };
                          })}
                          emptyLabel={loading ? "Loading drafts..." : "No draft subcontract POs."}
                        />
                        <Pagination
                          page={pagedDraft.page}
                          totalPages={pagedDraft.totalPages}
                          onChange={(page) => setPages((prev) => ({ ...prev, draft: page }))}
                        />
                      </>
                    )
                  },
                  {
                    label: `Pending (${filteredPending.length})`,
                    value: "pending",
                    content: (
                      <>
                        <DataTable
                          columns={[
                            { key: "po", label: "PO" },
                            { key: "vendor", label: "Subcontractor" },
                            { key: "linked", label: "Linked Sales Orders" },
                            { key: "value", label: "Value", align: "right" },
                            { key: "status", label: "Status" },
                            { key: "actions", label: "" }
                          ]}
                          rows={pagedPending.items.map((order) => {
                            const linked = collectLinkedOrders(order);
                            return {
                              po: order.poNumber ?? "—",
                              vendor: order.vendor.name,
                              linked: linked.length ? (
                                <div className="space-y-1 text-xs text-text-muted">
                                  {linked.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                      <span className="text-text">{item.label}</span>
                                      <span>{item.customer ?? ""}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "Manual"
                              ),
                              value: order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0).toFixed(2),
                              status: <Badge {...statusBadge[order.status]} />,
                              actions: (
                                <div className="flex gap-2">
                                  <Button variant="ghost" onClick={() => approveOrder(order.id)}>
                                    Approve
                                  </Button>
                                  <Button variant="ghost" onClick={() => deleteOrder(order)}>
                                    Delete
                                  </Button>
                                </div>
                              )
                            };
                          })}
                          emptyLabel={loading ? "Loading pending POs..." : "No pending subcontract POs."}
                        />
                        <Pagination
                          page={pagedPending.page}
                          totalPages={pagedPending.totalPages}
                          onChange={(page) => setPages((prev) => ({ ...prev, pending: page }))}
                        />
                      </>
                    )
                  },
                  {
                    label: `Approved (${filteredApproved.length})`,
                    value: "approved",
                    content: (
                      <>
                        <DataTable
                          columns={[
                            { key: "po", label: "PO" },
                            { key: "vendor", label: "Subcontractor" },
                            { key: "linked", label: "Linked Sales Orders" },
                            { key: "open", label: "Open Lines", align: "right" },
                            { key: "pendingQty", label: "Pending Qty" },
                            { key: "status", label: "Status" },
                            { key: "actions", label: "" }
                          ]}
                          rows={pagedApproved.items.map((order) => {
                            const linked = collectLinkedOrders(order);
                            return {
                              po: order.poNumber ?? "—",
                              vendor: order.vendor.name,
                              linked: linked.length ? (
                                <div className="space-y-1 text-xs text-text-muted">
                                  {linked.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                      <span className="text-text">{item.label}</span>
                                      <span>{item.customer ?? ""}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "Manual"
                              ),
                              open: order.lines.filter((line) => line.receivedQty < line.quantity).length,
                              pendingQty: (() => {
                                const pending = order.lines
                                  .filter((line) => line.receivedQty < line.quantity)
                                  .map((line) => ({
                                    label: `${line.sku.code} · ${line.sku.name}`,
                                    qty: `${(line.quantity - line.receivedQty)
                                      .toFixed(2)
                                      .replace(/\.00$/, "")} ${line.sku.unit}`
                                  }));
                                if (!pending.length) return "—";
                                return (
                                  <div className="space-y-1 text-xs text-text-muted">
                                    {pending.map((line) => (
                                      <div key={line.label} className="flex items-center justify-between gap-3">
                                        <span className="text-text">{line.label}</span>
                                        <span>{line.qty}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })(),
                              status: (() => {
                                const hasPartial = order.lines.some(
                                  (line) => line.receivedQty > 0 && line.receivedQty < line.quantity
                                );
                                return (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge {...statusBadge[order.status]} />
                                    {hasPartial ? <Badge variant="warning" label="Partial" /> : null}
                                  </div>
                                );
                              })(),
                              actions: (
                                <div className="flex gap-2">
                                  <Button variant="ghost" onClick={() => openReceive(order)}>
                                    Receive
                                  </Button>
                                  <Button variant="ghost" onClick={() => closeOrder(order)}>
                                    Close
                                  </Button>
                                  <Button variant="ghost" onClick={() => deleteOrder(order)}>
                                    Delete
                                  </Button>
                                </div>
                              )
                            };
                          })}
                          emptyLabel={loading ? "Loading approved POs..." : "No approved subcontract POs."}
                        />
                        <Pagination
                          page={pagedApproved.page}
                          totalPages={pagedApproved.totalPages}
                          onChange={(page) => setPages((prev) => ({ ...prev, approved: page }))}
                        />
                      </>
                    )
                  },
                  {
                    label: `Completed (${filteredReceived.length})`,
                    value: "completed",
                    content: (
                      <>
                        <DataTable
                          columns={[
                            { key: "po", label: "PO" },
                            { key: "vendor", label: "Subcontractor" },
                            { key: "linked", label: "Linked Sales Orders" },
                            { key: "lines", label: "Lines", align: "right" },
                            { key: "received", label: "Received" },
                            { key: "status", label: "Status" },
                            { key: "receipt", label: "" }
                          ]}
                          rows={pagedReceived.items.map((order) => {
                            const linked = collectLinkedOrders(order);
                            return {
                              po: order.poNumber ?? "—",
                              vendor: order.vendor.name,
                              linked: linked.length ? (
                                <div className="space-y-1 text-xs text-text-muted">
                                  {linked.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                      <span className="text-text">{item.label}</span>
                                      <span>{item.customer ?? ""}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "Manual"
                              ),
                              lines: order.lines.length,
                              received:
                                latestReceiptDate(order)?.slice(0, 10) ??
                                (order.closedAt ? new Date(order.closedAt).toLocaleDateString("en-IN") : "—"),
                              status: <Badge {...statusBadge[order.status]} />,
                              receipt: latestReceipt(order)?.id ? (
                                <Button variant="ghost" onClick={() => downloadReceipt(latestReceipt(order)!.id)}>
                                  Receipt
                                </Button>
                              ) : (
                                "—"
                              )
                            };
                          })}
                          emptyLabel={loading ? "Loading completed POs..." : "No completed subcontract POs."}
                        />
                        <Pagination
                          page={pagedReceived.page}
                          totalPages={pagedReceived.totalPages}
                          onChange={(page) => setPages((prev) => ({ ...prev, received: page }))}
                        />
                      </>
                    )
                  },
                  {
                    label: `Deleted (${filteredDeleted.length})`,
                    value: "deleted",
                    content: (
                      <>
                        <DataTable
                          columns={[
                            { key: "po", label: "PO" },
                            { key: "vendor", label: "Subcontractor" },
                            { key: "linked", label: "Linked Sales Orders" },
                            { key: "lines", label: "Lines", align: "right" },
                            { key: "deleted", label: "Deleted" }
                          ]}
                          rows={pagedDeleted.items.map((order) => {
                            const linked = collectLinkedOrders(order);
                            return {
                              po: order.poNumber ?? "—",
                              vendor: order.vendor.name,
                              linked: linked.length ? (
                                <div className="space-y-1 text-xs text-text-muted">
                                  {linked.map((item) => (
                                    <div key={item.label} className="flex items-center justify-between gap-3">
                                      <span className="text-text">{item.label}</span>
                                      <span>{item.customer ?? ""}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                "Manual"
                              ),
                              lines: order.lines.length,
                              deleted: order.deletedAt ? order.deletedAt.slice(0, 10) : "—"
                            };
                          })}
                          emptyLabel={loading ? "Loading deleted POs..." : "No deleted subcontract POs."}
                        />
                        <Pagination
                          page={pagedDeleted.page}
                          totalPages={pagedDeleted.totalPages}
                          onChange={(page) => setPages((prev) => ({ ...prev, deleted: page }))}
                        />
                      </>
                    )
                  }
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {receivePo ? (
        <div ref={receiveRef}>
          <Card>
            <CardHeader>
              <CardTitle>Receive Finished Goods</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  Receiving against {receivePo.poNumber ?? receivePo.id}. Finished stock will be updated.
                </p>
                <Select
                  label="Receive To"
                  value={receiveZoneId}
                  onChange={(event) => setReceiveZoneId(event.target.value)}
                  options={finishedZoneOptions}
                  required
                />
                <div className="space-y-3">
                  {receiveLines.length === 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted">
                      No open lines to receive.
                    </div>
                  ) : (
                    receiveLines.map((line) => (
                      <div key={line.poLineId} className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
                          <Input label="SKU" value={`${line.sku.code} · ${line.sku.name}`} readOnly />
                          <Input label="Open Qty" value={`${line.openQty} ${line.sku.unit}`} readOnly />
                          <Input
                            label="Receive Qty"
                            value={line.qty}
                            onChange={(event) => {
                              const value = event.target.value;
                              setReceiveLines((prev) =>
                                prev.map((item) =>
                                  item.poLineId === line.poLineId ? { ...item, qty: value } : item
                                )
                              );
                            }}
                            type="number"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setReceivePo(null)}>
                    Cancel
                  </Button>
                  <Button onClick={receiveOrder}>Post Receipt</Button>
                  {lastReceiptId ? (
                    <Button variant="secondary" onClick={() => downloadReceipt(lastReceiptId)}>
                      Download Receipt
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <ToastViewport toasts={toasts} onDismiss={remove} />
    </div>
  );
}
