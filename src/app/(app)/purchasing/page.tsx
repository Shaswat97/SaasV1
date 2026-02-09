"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { Tabs } from "@/components/Tabs";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type Vendor = { id: string; code: string; name: string; vendorType?: string | null };

type RawSku = { id: string; code: string; name: string; unit: string };

type VendorSku = { id: string; skuId: string; lastPrice?: number | null; sku: RawSku };

type Zone = { id: string; name: string; code: string; type: string };

type PurchaseOrderLine = {
  id: string;
  skuId: string;
  sku: RawSku;
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  taxPct?: number | null;
  expectedDate?: string | null;
  qcStatus?: string | null;
  qcNotes?: string | null;
  receivedQty: number;
  shortClosedQty?: number | null;
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
  sku: RawSku;
  openQty: number;
  qty: string;
};

type PageState = {
  draft: number;
  pending: number;
  approved: number;
  received: number;
  deleted: number;
  consolidated: number;
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

export default function PurchasingPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rawSkus, setRawSkus] = useState<RawSku[]>([]);
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
  const [completedStart, setCompletedStart] = useState(today);
  const [completedEnd, setCompletedEnd] = useState(today);
  const [pages, setPages] = useState<PageState>({
    draft: 1,
    pending: 1,
    approved: 1,
    received: 1,
    deleted: 1,
    consolidated: 1
  });

  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [vendorData, skuData, zoneData, orderData] = await Promise.all([
        apiGet<Vendor[]>("/api/vendors"),
        apiGet<RawSku[]>("/api/raw-skus"),
        apiGet<Zone[]>("/api/zones"),
        apiGet<PurchaseOrder[]>("/api/purchase-orders?includeDeleted=true")
      ]);
      setVendors(vendorData);
      setRawSkus(skuData);
      setZones(zoneData);
      setOrders(orderData);
      if (!vendorId) {
        const firstRaw = vendorData.find((vendor) => (vendor.vendorType ?? "RAW") === "RAW");
        if (firstRaw) setVendorId(firstRaw.id);
      }
      const rawZone = zoneData.find((zone) => zone.type === "RAW_MATERIAL");
      if (!receiveZoneId && rawZone) setReceiveZoneId(rawZone.id);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load purchasing data");
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
        push("error", error.message ?? "Failed to load vendor SKUs");
      }
    }

    loadVendorSkus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  useEffect(() => {
    setPages({ draft: 1, pending: 1, approved: 1, received: 1, deleted: 1, consolidated: 1 });
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
    setCompletedStart(today);
    setCompletedEnd(today);
  }

  async function deleteOrder(order: PurchaseOrder) {
    if (!window.confirm(`Delete PO ${order.poNumber ?? order.id}? It will appear in Deleted tab.`)) {
      return;
    }
    try {
      await apiSend(`/api/purchase-orders/${order.id}`, "DELETE");
      push("success", "PO deleted");
      if (editingId === order.id) resetForm();
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
      push("error", "Link raw SKUs to this vendor before creating a PO");
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
      push("error", "Vendor is required");
      return;
    }

    if (!vendorSkus.length) {
      push("error", "This vendor has no linked SKUs. Link SKUs in the Vendor page first.");
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
      push("error", "One or more SKUs are not linked to this vendor");
      return;
    }

    try {
      if (editingId) {
        await apiSend(`/api/purchase-orders/${editingId}`, "PUT", {
          notes,
          lines: payloadLines
        });
        push("success", "Purchase order updated");
      } else {
        await apiSend("/api/purchase-orders", "POST", {
          vendorId,
          notes,
          consolidate,
          lines: payloadLines
        });
        push("success", consolidate ? "Draft PO updated" : "Purchase order created");
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save purchase order");
    }
  }

  async function confirmOrder(orderId: string) {
    try {
      await apiSend(`/api/purchase-orders/${orderId}/confirm`, "POST");
      push("success", "PO confirmed");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to confirm PO");
    }
  }

  async function approveOrder(orderId: string) {
    try {
      await apiSend(`/api/purchase-orders/${orderId}/approve`, "POST");
      push("success", "PO approved");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to approve PO");
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
    const zonesForType = order.type === "SUBCONTRACT" ? finishedZoneOptions : rawZoneOptions;
    if (!receiveZoneId || !zonesForType.some((zone) => zone.value === receiveZoneId)) {
      setReceiveZoneId(zonesForType[0]?.value ?? "");
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
        push("success", "Receipt posted. PO fully received.");
      } else {
        const first = result.remainingLines[0];
        const more = result.remainingLines.length > 1 ? ` +${result.remainingLines.length - 1} more` : "";
        push(
          "info",
          `Partial receipt: ${first.remainingQty} ${first.unit} pending for ${first.skuCode} · ${first.skuName}${more}.`
        );
      }
      setReceivePo(null);
      setReceiveLines([]);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to receive PO");
    }
  }

  function filteredOrders(items: PurchaseOrder[]) {
    return items.filter((order) => {
      const matchesVendor = vendorFilter === "ALL" || order.vendorId === vendorFilter;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        order.poNumber?.toLowerCase().includes(term) ||
        order.vendor.name.toLowerCase().includes(term) ||
        order.vendor.code.toLowerCase().includes(term);
      return matchesVendor && matchesSearch;
    });
  }

  const activeOrders = useMemo(() => orders.filter((order) => !order.deletedAt), [orders]);
  const deletedOrders = useMemo(() => orders.filter((order) => order.deletedAt), [orders]);
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

  const vendorLeadTime = useMemo(() => {
    if (!vendorId) return null;
    let latest: { receivedAt: string; orderDate: string; poNumber?: string | null } | null = null;
    orders
      .filter((order) => order.vendorId === vendorId && order.receipts && order.receipts.length)
      .forEach((order) => {
        order.receipts?.forEach((receipt) => {
          if (!latest || new Date(receipt.receivedAt) > new Date(latest.receivedAt)) {
            latest = { receivedAt: receipt.receivedAt, orderDate: order.orderDate, poNumber: order.poNumber };
          }
        });
      });
    if (!latest) return null;
    const diffMs = new Date(latest.receivedAt).getTime() - new Date(latest.orderDate).getTime();
    const days = Math.max(1, Math.round(diffMs / 86400000));
    return { ...latest, days };
  }, [orders, vendorId]);

  const pagedDraft = paginate(filteredDraft, pages.draft);
  const pagedPending = paginate(filteredPending, pages.pending);
  const pagedApproved = paginate(filteredApproved, pages.approved);
  const pagedReceived = paginate(filteredReceived, pages.received);
  const pagedDeleted = paginate(filteredDeleted, pages.deleted);

  const consolidated = useMemo(() => {
    const map = new Map<string, { vendor: Vendor; orders: PurchaseOrder[] }>();
    filteredDraft.forEach((order) => {
      const existing = map.get(order.vendorId);
      if (existing) {
        existing.orders.push(order);
      } else {
        map.set(order.vendorId, { vendor: order.vendor, orders: [order] });
      }
    });
    return Array.from(map.values());
  }, [filteredDraft]);

  const pagedConsolidated = paginate(consolidated, pages.consolidated);

  const vendorOptions = useMemo(
    () =>
      vendors.map((vendor) => ({
        value: vendor.id,
        label: `${vendor.code} · ${vendor.name}`,
        vendorType: vendor.vendorType ?? "RAW"
      })),
    [vendors]
  );

  const rawVendorOptions = useMemo(
    () => vendorOptions.filter((vendor) => vendor.vendorType === "RAW").map(({ value, label }) => ({ value, label })),
    [vendorOptions]
  );

  const vendorFilterOptions = useMemo(
    () => [{ value: "ALL", label: "All Vendors" }, ...vendorOptions.map(({ value, label }) => ({ value, label }))],
    [vendorOptions]
  );

  const vendorSkuMap = useMemo(() => new Map(vendorSkus.map((mapping) => [mapping.skuId, mapping])), [vendorSkus]);

  const skuOptions = useMemo(
    () => vendorSkus.map((mapping) => ({ value: mapping.skuId, label: `${mapping.sku.code} · ${mapping.sku.name}` })),
    [vendorSkus]
  );

  const rawZoneOptions = useMemo(() => {
    const raw = zones.filter((zone) => zone.type === "RAW_MATERIAL");
    return raw.map((zone) => ({ value: zone.id, label: `${zone.name} · ${zone.code}` }));
  }, [zones]);

  const finishedZoneOptions = useMemo(() => {
    const finished = zones.filter((zone) => zone.type === "FINISHED");
    return finished.map((zone) => ({ value: zone.id, label: `${zone.name} · ${zone.code}` }));
  }, [zones]);

  function exportPdf() {
    const buildTable = (items: PurchaseOrder[]) => {
      const rows = items
        .map((order) => {
          const value = order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0);
          return `
            <tr>
              <td>${order.poNumber ?? "—"}</td>
              <td>${order.vendor.code} · ${order.vendor.name}</td>
              <td>${order.status}</td>
              <td>${order.lines.length}</td>
              <td>${value.toFixed(2)}</td>
            </tr>
          `;
        })
        .join("");
      return rows || `<tr><td colspan="5">No records</td></tr>`;
    };

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Purchasing Summary</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
            h2 { margin-top: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f3f3f3; }
          </style>
        </head>
        <body>
          <h1>Purchasing Summary</h1>
          <p>Generated on ${new Date().toLocaleString("en-IN")}</p>
          <h2>Draft POs</h2>
          <table>
            <thead>
              <tr><th>PO</th><th>Vendor</th><th>Status</th><th>Lines</th><th>Value</th></tr>
            </thead>
            <tbody>${buildTable(filteredDraft)}</tbody>
          </table>
          <h2>Pending POs</h2>
          <table>
            <thead>
              <tr><th>PO</th><th>Vendor</th><th>Status</th><th>Lines</th><th>Value</th></tr>
            </thead>
            <tbody>${buildTable(filteredPending)}</tbody>
          </table>
          <h2>Approved POs</h2>
          <table>
            <thead>
              <tr><th>PO</th><th>Vendor</th><th>Status</th><th>Lines</th><th>Value</th></tr>
            </thead>
            <tbody>${buildTable(filteredApproved)}</tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=960,height=720");
    if (!printWindow) {
      push("error", "Popup blocked. Allow popups to export PDF.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Purchasing"
        subtitle="Create, confirm, approve, and receive purchase orders with consolidation by vendor."
        actions={
          <>
            <Button variant="secondary" onClick={exportPdf}>
              Export PDF
            </Button>
            <Button variant="secondary" onClick={() => router.push("/purchasing/subcontracting")}>
              Subcontracting
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Purchase Order" : "Create Manual PO"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Select
                label="Vendor"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
                options={rawVendorOptions}
                required
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
                Consolidate into vendor draft PO
              </label>

              <div className="space-y-3">
                {lines.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted">
                    Add PO lines to begin.
                  </div>
                ) : (
                  lines.map((line, index) => (
                    <div
                      key={`${line.skuId}-${index}`}
                      className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4"
                    >
                      <div className="grid gap-3 lg:grid-cols-2">
                        <Select
                          label="Raw SKU"
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
                                  const fallback = rawSkus.find((sku) => sku.id === line.skuId);
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
                          hint={
                            vendorLeadTime
                              ? `Last lead time: ${vendorLeadTime.days} day${vendorLeadTime.days === 1 ? "" : "s"} (PO ${
                                  vendorLeadTime.poNumber ?? "—"
                                } · ${new Date(vendorLeadTime.orderDate).toLocaleDateString("en-IN")} → ${new Date(
                                  vendorLeadTime.receivedAt
                                ).toLocaleDateString("en-IN")})`
                              : "No receipt history yet."
                          }
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
                  placeholder="PO number or vendor"
                />
                <Select
                  label="Vendor"
                  value={vendorFilter}
                  onChange={(event) => setVendorFilter(event.target.value)}
                  options={vendorFilterOptions}
                />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Input
                  label="Received From"
                  type="date"
                  value={completedStart}
                  onChange={(event) => setCompletedStart(event.target.value)}
                />
                <Input
                  label="Received To"
                  type="date"
                  value={completedEnd}
                  onChange={(event) => setCompletedEnd(event.target.value)}
                />
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
              <CardTitle>Purchase Orders</CardTitle>
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
                            { key: "vendor", label: "Vendor" },
                            { key: "type", label: "Type" },
                            { key: "items", label: "Line Items" },
                            { key: "lines", label: "Lines", align: "right" },
                            { key: "status", label: "Status" },
                            { key: "actions", label: "" }
                          ]}
                          rows={pagedDraft.items.map((order) => ({
                            po: order.poNumber ?? "—",
                            vendor: order.vendor.name,
                            type: order.type === "SUBCONTRACT" ? "Subcontract" : "Raw",
                            items: order.lines.length ? (
                              <div className="space-y-1 text-xs text-text-muted">
                                {order.lines.map((line) => (
                                  <div key={line.id} className="flex items-center justify-between gap-3">
                                    <span className="text-text">{line.sku.code} · {line.sku.name}</span>
                                    <span>{line.quantity} {line.sku.unit}</span>
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
                                {order.type !== "SUBCONTRACT" ? (
                                  <Button variant="ghost" onClick={() => handleEdit(order)}>
                                    Edit
                                  </Button>
                                ) : null}
                                <Button variant="ghost" onClick={() => deleteOrder(order)}>
                                  Delete
                                </Button>
                                <Button variant="ghost" onClick={() => confirmOrder(order.id)}>
                                  Confirm
                                </Button>
                              </div>
                            )
                          }))}
                          emptyLabel={loading ? "Loading drafts..." : "No draft POs."}
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
                            { key: "vendor", label: "Vendor" },
                            { key: "type", label: "Type" },
                            { key: "value", label: "Value", align: "right" },
                            { key: "status", label: "Status" },
                            { key: "actions", label: "" }
                          ]}
                          rows={pagedPending.items.map((order) => ({
                            po: order.poNumber ?? "—",
                            vendor: order.vendor.name,
                            type: order.type === "SUBCONTRACT" ? "Subcontract" : "Raw",
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
                          }))}
                          emptyLabel={loading ? "Loading pending POs..." : "No pending POs."}
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
                            { key: "vendor", label: "Vendor" },
                            { key: "type", label: "Type" },
                            { key: "open", label: "Open Lines", align: "right" },
                            { key: "inwardQty", label: "Inwarded Qty" },
                            { key: "status", label: "Status" },
                            { key: "actions", label: "" }
                          ]}
                          rows={pagedApproved.items.map((order) => ({
                            po: order.poNumber ?? "—",
                            vendor: order.vendor.name,
                            type: order.type === "SUBCONTRACT" ? "Subcontract" : "Raw",
                            open: order.lines.filter((line) => line.receivedQty < line.quantity).length,
                            pendingQty: (() => {
                              const pending = order.lines
                                .filter((line) => line.receivedQty < line.quantity)
                                .map((line) => ({
                                  label: `${line.sku.code} · ${line.sku.name}`,
                                  qty: `${(line.quantity - line.receivedQty).toFixed(2).replace(/\.00$/, "")} ${line.sku.unit}`
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
                          }))}
                          emptyLabel={loading ? "Loading approved POs..." : "No approved POs."}
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
                            { key: "vendor", label: "Vendor" },
                            { key: "type", label: "Type" },
                            { key: "orderDate", label: "Order Date" },
                            { key: "receivedDate", label: "Received Date" },
                            { key: "pendingQty", label: "Pending Qty" },
                            { key: "items", label: "Items" },
                            { key: "lines", label: "Lines", align: "right" },
                            { key: "value", label: "Value", align: "right" },
                            { key: "status", label: "Status" },
                            { key: "receipt", label: "" }
                          ]}
                          rows={pagedReceived.items.map((order) => ({
                            po: order.poNumber ?? "—",
                            vendor: order.vendor.name,
                            type: order.type === "SUBCONTRACT" ? "Subcontract" : "Raw",
                            orderDate: order.orderDate ? new Date(order.orderDate).toLocaleDateString("en-IN") : "—",
                            receivedDate: latestReceiptDate(order)
                              ? new Date(latestReceiptDate(order) as string).toLocaleDateString("en-IN")
                              : order.closedAt
                                ? new Date(order.closedAt).toLocaleDateString("en-IN")
                                : "—",
                            inwardQty: (() => {
                              const inward = order.lines
                                .filter((line) => line.receivedQty > 0)
                                .map((line) => ({
                                  label: `${line.sku.code} · ${line.sku.name}`,
                                  qty: `${line.receivedQty.toFixed(2).replace(/\\.00$/, "")} ${line.sku.unit}`
                                }));
                              if (!inward.length) return "—";
                              return (
                                <div className="space-y-1 text-xs text-text-muted">
                                  {inward.map((line) => (
                                    <div key={line.label} className="flex items-center justify-between gap-3">
                                      <span className="text-text">{line.label}</span>
                                      <span>{line.qty}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })(),
                            items: order.lines.length ? (
                              <div className="space-y-1 text-xs text-text-muted">
                                {order.lines.map((line) => (
                                  <div key={line.id} className="flex items-center justify-between gap-3">
                                    <span className="text-text">{line.sku.code} · {line.sku.name}</span>
                                    <span>₹{line.unitPrice.toFixed(2).replace(/\\.00$/, "")}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              "—"
                            ),
                            lines: order.lines.length,
                            value: order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0).toFixed(2),
                            status: <Badge {...statusBadge[order.status]} />,
                            receipt: latestReceipt(order)?.id ? (
                              <Button variant="ghost" onClick={() => downloadReceipt(latestReceipt(order)!.id)}>
                                Receipt
                              </Button>
                            ) : (
                              "—"
                            )
                          }))}
                          emptyLabel={loading ? "Loading completed POs..." : "No completed POs in this range."}
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
                            { key: "vendor", label: "Vendor" },
                            { key: "type", label: "Type" },
                            { key: "deletedAt", label: "Deleted On" },
                            { key: "lines", label: "Lines", align: "right" },
                            { key: "status", label: "Status" }
                          ]}
                          rows={pagedDeleted.items.map((order) => ({
                            po: order.poNumber ?? "—",
                            vendor: order.vendor.name,
                            type: order.type === "SUBCONTRACT" ? "Subcontract" : "Raw",
                            deletedAt: order.deletedAt ? new Date(order.deletedAt).toLocaleDateString("en-IN") : "—",
                            lines: order.lines.length,
                            status: <Badge variant="danger" label="Deleted" />
                          }))}
                          emptyLabel={loading ? "Loading deleted POs..." : "No deleted POs."}
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

          <Card variant="strong">
            <CardHeader>
              <CardTitle>Consolidated Vendor Drafts</CardTitle>
            </CardHeader>
            <CardBody>
              <DataTable
                columns={[
                  { key: "vendor", label: "Vendor" },
                  { key: "po", label: "Draft PO" },
                  { key: "lines", label: "Lines", align: "right" },
                  { key: "value", label: "Value", align: "right" }
                ]}
                rows={pagedConsolidated.items.map((group) => ({
                  vendor: group.vendor.name,
                  po: group.orders[0]?.poNumber ?? "—",
                  lines: group.orders.reduce((sum, order) => sum + order.lines.length, 0),
                  value: group.orders
                    .reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + lineNetTotal(line), 0), 0)
                    .toFixed(2)
                }))}
                emptyLabel={loading ? "Loading drafts..." : "No vendor drafts found."}
              />
              <Pagination
                page={pagedConsolidated.page}
                totalPages={pagedConsolidated.totalPages}
                onChange={(page) => setPages((prev) => ({ ...prev, consolidated: page }))}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <div ref={receiveRef}>
        <Card>
          <CardHeader>
            <CardTitle>Receive Against PO</CardTitle>
          </CardHeader>
          <CardBody>
            {!receivePo ? (
              <p className="text-sm text-text-muted">Select an approved PO to receive.</p>
            ) : receiveLines.length === 0 ? (
              <p className="text-sm text-text-muted">All lines are fully received.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-muted">Receiving for</p>
                    <p className="text-lg font-semibold">{receivePo.poNumber ?? "PO"} · {receivePo.vendor.name}</p>
                  </div>
                  <Select
                    label={receivePo.type === "SUBCONTRACT" ? "Finished Zone" : "Raw Zone"}
                    value={receiveZoneId}
                    onChange={(event) => setReceiveZoneId(event.target.value)}
                    options={receivePo.type === "SUBCONTRACT" ? finishedZoneOptions : rawZoneOptions}
                  />
                </div>
                <div className="space-y-3">
                  {receiveLines.map((line, index) => (
                    <div
                      key={line.poLineId}
                      className="grid gap-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4 lg:grid-cols-[2fr_1fr_1fr]"
                    >
                      <div>
                        <p className="text-sm font-medium">{line.sku.code} · {line.sku.name}</p>
                        <p className="text-xs text-text-muted">Open: {line.openQty} {line.sku.unit}</p>
                      </div>
                      <Input
                        label="Receive Qty"
                        value={line.qty}
                        onChange={(event) => {
                          const value = event.target.value;
                          setReceiveLines((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, qty: value } : item))
                          );
                        }}
                        type="number"
                        required
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setReceiveLines((prev) => prev.filter((_, idx) => idx !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={receiveOrder}>Post Receipt</Button>
                  {lastReceiptId ? (
                    <Button variant="secondary" onClick={() => downloadReceipt(lastReceiptId)}>
                      Download Receipt
                    </Button>
                  ) : null}
                  <Button variant="ghost" onClick={() => setReceivePo(null)}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
