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
import { DateFilter, getPresetRange } from "@/components/DateFilter";
import type { DateRange } from "@/components/DateFilter";
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

type VendorBill = {
  id: string;
  billNumber?: string | null;
  status: string;
  billDate: string;
  dueDate?: string | null;
  totalAmount: number;
  balanceAmount: number;
  vendor: Vendor;
  purchaseOrder?: { id: string; poNumber?: string | null } | null;
  receipt?: { id: string; receivedAt: string } | null;
  lines: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalCost: number;
    sku: { id: string; code: string; name: string; unit: string };
  }>;
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
  poTab: string;
  billTab: string;
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

function summarizeBillSkus(lines: VendorBill["lines"]) {
  if (!lines.length) return "—";
  const labels = lines.map((line) => `${line.sku.code} · ${line.sku.name}`);
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
}

function summarizeBillUnitPrice(lines: VendorBill["lines"]) {
  if (!lines.length) return "—";
  const prices = lines.map((line) => line.unitPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return min.toFixed(2);
  return `${min.toFixed(2)} - ${max.toFixed(2)}`;
}

function summarizeBillQty(lines: VendorBill["lines"]) {
  if (!lines.length) return "—";
  if (lines.length === 1) {
    const line = lines[0];
    return `${line.quantity.toLocaleString("en-IN")} ${line.sku.unit}`;
  }

  const preview = lines
    .slice(0, 2)
    .map((line) => `${line.quantity.toLocaleString("en-IN")} ${line.sku.unit}`)
    .join(", ");
  return lines.length > 2 ? `${preview} +${lines.length - 2} more` : preview;
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
  const [rawSkus, setRawSkus] = useState<RawSku[]>([]);
  const [vendorSkus, setVendorSkus] = useState<VendorSku[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
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
  const [billPaymentId, setBillPaymentId] = useState("");
  const [billPaymentAmount, setBillPaymentAmount] = useState("");
  const [billPaymentDate, setBillPaymentDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [billPaymentMethod, setBillPaymentMethod] = useState("");
  const [billPaymentReference, setBillPaymentReference] = useState("");
  const [billPaymentNotes, setBillPaymentNotes] = useState("");
  const [billPaymentSubmitting, setBillPaymentSubmitting] = useState(false);

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
    deleted: 1,
    consolidated: 1,
    poTab: "drafts",
    billTab: "all"
  });

  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [vendorData, skuData, zoneData, orderData, billData] = await Promise.all([
        apiGet<Vendor[]>("/api/vendors"),
        apiGet<RawSku[]>("/api/raw-skus"),
        apiGet<Zone[]>("/api/zones"),
        apiGet<PurchaseOrder[]>("/api/purchase-orders?includeDeleted=true"),
        apiGet<VendorBill[]>("/api/vendor-bills")
      ]);
      setVendors(vendorData);
      setRawSkus(skuData);
      setZones(zoneData);
      setOrders(orderData);
      setVendorBills(billData);
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
    setPages({ draft: 1, pending: 1, approved: 1, received: 1, deleted: 1, consolidated: 1, poTab: "drafts", billTab: "all" });
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

  async function submitVendorPayment() {
    if (!billPaymentId) {
      push("error", "Select a vendor bill to record payment");
      return;
    }
    const amount = Number(billPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      push("error", "Enter a valid payment amount");
      return;
    }
    setBillPaymentSubmitting(true);
    try {
      await apiSend("/api/vendor-payments", "POST", {
        billId: billPaymentId,
        amount,
        paymentDate: billPaymentDate ? new Date(billPaymentDate).toISOString() : undefined,
        method: billPaymentMethod || undefined,
        reference: billPaymentReference || undefined,
        notes: billPaymentNotes || undefined
      });
      push("success", "Vendor payment recorded");
      setBillPaymentAmount("");
      setBillPaymentMethod("");
      setBillPaymentReference("");
      setBillPaymentNotes("");
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to record vendor payment");
    } finally {
      setBillPaymentSubmitting(false);
    }
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
    const receiptCandidates = orders
      .filter((order) => order.vendorId === vendorId)
      .map((order) => {
        const receipt = latestReceipt(order);
        if (!receipt) return null;
        return {
          receivedAt: receipt.receivedAt,
          orderDate: order.orderDate,
          poNumber: order.poNumber ?? null
        };
      })
      .filter(
        (item): item is { receivedAt: string; orderDate: string; poNumber: string | null } => item !== null
      );
    if (!receiptCandidates.length) return null;
    const latest = receiptCandidates.reduce((current, item) => {
      return new Date(item.receivedAt) > new Date(current.receivedAt) ? item : current;
    }, receiptCandidates[0]);
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

  const openBills = useMemo(() => vendorBills.filter((bill) => bill.balanceAmount > 0), [vendorBills]);

  const billOptions = useMemo(
    () =>
      openBills.map((bill) => ({
        value: bill.id,
        label: `${bill.billNumber ?? bill.id} · ${bill.vendor.name} · ${summarizeBillSkus(bill.lines)} · Bal ${bill.balanceAmount.toFixed(2)}`
      })),
    [openBills]
  );

  useEffect(() => {
    if (!billPaymentId || !openBills.some((bill) => bill.id === billPaymentId)) {
      setBillPaymentId(openBills[0]?.id ?? "");
    }
  }, [openBills, billPaymentId]);

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

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
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
                      <div className="grid gap-3">
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
                        <div className="grid grid-cols-2 gap-3">
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
                                  : ` · Δ ${diff >= 0 ? "+" : ""}${diff.toFixed(2).replace(/\.00$/, "")}`;
                              return `Vendor last price: ₹${mapping.lastPrice.toFixed(2).replace(/\.00$/, "")}${diffLabel}`;
                            })()}
                          />
                        </div>
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
                              ? `Last lead time: ${vendorLeadTime.days} day${vendorLeadTime.days === 1 ? "" : "s"} (PO ${vendorLeadTime.poNumber ?? "—"
                              } · ${new Date(vendorLeadTime.orderDate).toLocaleDateString("en-IN")} → ${new Date(
                                vendorLeadTime.receivedAt
                              ).toLocaleDateString("en-IN")})`
                              : "No receipt history yet."
                          }
                        />
                        <div className="grid grid-cols-2 gap-3">
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
                        </div>
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
            <div className="px-6 pt-5 pb-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-1">
                  {[
                    { key: "drafts", label: "Drafts", count: filteredDraft.length },
                    { key: "pending", label: "Pending", count: filteredPending.length },
                    { key: "approved", label: "Approved", count: filteredApproved.length },
                    { key: "completed", label: "Completed", count: filteredReceived.length },
                    { key: "deleted", label: "Deleted", count: filteredDeleted.length },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setPages((prev) => ({ ...prev, poTab: tab.key }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${pages.poTab === tab.key
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                        }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search POs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-3 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-48"
                  />
                </div>
              </div>
            </div>

            <CardBody className="pt-3">
              <div className="max-h-[600px] overflow-y-auto">
                {pages.poTab === "drafts" && (
                  <DataTable
                    columns={[
                      { key: "po", label: "PO" },
                      { key: "vendor", label: "Vendor" },
                      { key: "type", label: "Type" },
                      { key: "items", label: "Line Items" },
                      { key: "lines", label: "Lines", align: "right" as const },
                      { key: "status", label: "Status" },
                      { key: "actions", label: "" }
                    ]}
                    rows={filteredDraft.map((order) => ({
                      po: <span className="font-semibold text-accent">{order.poNumber ?? "—"}</span>,
                      vendor: order.vendor.name,
                      type: (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.type === "SUBCONTRACT" ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>{order.type === "SUBCONTRACT" ? "Subcontract" : "Raw"}</span>
                      ),
                      items: order.lines.length ? (
                        <div className="space-y-1 text-xs text-text-muted">
                          {order.lines.map((line) => (
                            <div key={line.id} className="flex items-center justify-between gap-3">
                              <span className="text-text">{line.sku.code} · {line.sku.name}</span>
                              <span className="font-medium">{line.quantity} {line.sku.unit}</span>
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-gray-300">—</span>,
                      lines: <span className="font-medium">{order.lines.length}</span>,
                      status: (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                          Draft
                        </span>
                      ),
                      actions: (
                        <div className="flex gap-1">
                          {order.type !== "SUBCONTRACT" && (
                            <button onClick={() => handleEdit(order)} className="px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors border border-gray-200">Edit</button>
                          )}
                          <button onClick={() => deleteOrder(order)} className="px-2.5 py-1 rounded-lg hover:bg-red-50 text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Delete</button>
                          <button onClick={() => confirmOrder(order.id)} className="px-2.5 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-xs font-medium text-green-700 hover:text-green-800 transition-colors border border-green-200">Confirm</button>
                        </div>
                      )
                    }))}
                    emptyLabel={loading ? "Loading drafts..." : "No draft POs."}
                  />
                )}

                {pages.poTab === "pending" && (
                  <DataTable
                    columns={[
                      { key: "po", label: "PO" },
                      { key: "vendor", label: "Vendor" },
                      { key: "type", label: "Type" },
                      { key: "value", label: "Value", align: "right" as const },
                      { key: "status", label: "Status" },
                      { key: "actions", label: "" }
                    ]}
                    rows={filteredPending.map((order) => ({
                      po: <span className="font-semibold text-accent">{order.poNumber ?? "—"}</span>,
                      vendor: order.vendor.name,
                      type: (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.type === "SUBCONTRACT" ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>{order.type === "SUBCONTRACT" ? "Subcontract" : "Raw"}</span>
                      ),
                      value: <span className="font-medium">₹{order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>,
                      status: (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                          Pending
                        </span>
                      ),
                      actions: (
                        <div className="flex gap-1">
                          <button onClick={() => approveOrder(order.id)} className="px-2.5 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-xs font-medium text-green-700 hover:text-green-800 transition-colors border border-green-200">Approve</button>
                          <button onClick={() => deleteOrder(order)} className="px-2.5 py-1 rounded-lg hover:bg-red-50 text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Delete</button>
                        </div>
                      )
                    }))}
                    emptyLabel={loading ? "Loading pending POs..." : "No pending POs."}
                  />
                )}

                {pages.poTab === "approved" && (
                  <DataTable
                    columns={[
                      { key: "po", label: "PO" },
                      { key: "vendor", label: "Vendor" },
                      { key: "type", label: "Type" },
                      { key: "open", label: "Open Lines", align: "right" as const },
                      { key: "inwardQty", label: "Inwarded Qty" },
                      { key: "status", label: "Status" },
                      { key: "actions", label: "" }
                    ]}
                    rows={filteredApproved.map((order) => {
                      const hasPartial = order.lines.some((line) => line.receivedQty > 0 && line.receivedQty < line.quantity);
                      return {
                        po: <span className="font-semibold text-accent">{order.poNumber ?? "—"}</span>,
                        vendor: order.vendor.name,
                        type: (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.type === "SUBCONTRACT" ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}>{order.type === "SUBCONTRACT" ? "Subcontract" : "Raw"}</span>
                        ),
                        open: (
                          <span className={`font-medium ${order.lines.filter((l) => l.receivedQty < l.quantity).length > 0 ? "text-orange-600" : "text-green-600"}`}>
                            {order.lines.filter((line) => line.receivedQty < line.quantity).length}
                          </span>
                        ),
                        inwardQty: (() => {
                          const pending = order.lines
                            .filter((line) => line.receivedQty < line.quantity)
                            .map((line) => ({
                              label: `${line.sku.code} · ${line.sku.name}`,
                              qty: `${(line.quantity - line.receivedQty).toFixed(2).replace(/\.00$/, "")} ${line.sku.unit}`
                            }));
                          if (!pending.length) return <span className="text-green-600 text-xs font-medium">Complete</span>;
                          return (
                            <div className="space-y-1 text-xs text-text-muted">
                              {pending.map((line) => (
                                <div key={line.label} className="flex items-center justify-between gap-3">
                                  <span className="text-text">{line.label}</span>
                                  <span className="text-orange-600 font-medium">{line.qty}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })(),
                        status: (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              Approved
                            </span>
                            {hasPartial && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                                Partial
                              </span>
                            )}
                          </div>
                        ),
                        actions: (
                          <div className="flex gap-1">
                            <button onClick={() => openReceive(order)} className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 hover:text-blue-800 transition-colors border border-blue-200">Receive</button>
                            <button onClick={() => closeOrder(order)} className="px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors border border-gray-200">Close</button>
                            <button onClick={() => deleteOrder(order)} className="px-2.5 py-1 rounded-lg hover:bg-red-50 text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Delete</button>
                          </div>
                        )
                      };
                    })}
                    emptyLabel={loading ? "Loading approved POs..." : "No approved POs."}
                  />
                )}

                {pages.poTab === "completed" && (
                  <DataTable
                    columns={[
                      { key: "po", label: "PO" },
                      { key: "vendor", label: "Vendor" },
                      { key: "type", label: "Type" },
                      { key: "orderDate", label: "Order Date" },
                      { key: "receivedDate", label: "Received Date" },
                      { key: "lines", label: "Lines", align: "right" as const },
                      { key: "value", label: "Value", align: "right" as const },
                      { key: "status", label: "Status" },
                      { key: "receipt", label: "" }
                    ]}
                    rows={filteredReceived.map((order) => ({
                      po: <span className="font-semibold text-accent">{order.poNumber ?? "—"}</span>,
                      vendor: order.vendor.name,
                      type: (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.type === "SUBCONTRACT" ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>{order.type === "SUBCONTRACT" ? "Subcontract" : "Raw"}</span>
                      ),
                      orderDate: order.orderDate ? new Date(order.orderDate).toLocaleDateString("en-IN") : "—",
                      receivedDate: latestReceiptDate(order)
                        ? new Date(latestReceiptDate(order) as string).toLocaleDateString("en-IN")
                        : order.closedAt
                          ? new Date(order.closedAt).toLocaleDateString("en-IN")
                          : "—",
                      lines: <span className="font-medium">{order.lines.length}</span>,
                      value: <span className="font-medium">₹{order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>,
                      status: (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {order.status === "CLOSED" ? "Closed" : "Received"}
                        </span>
                      ),
                      receipt: latestReceipt(order)?.id ? (
                        <button onClick={() => downloadReceipt(latestReceipt(order)!.id)} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-accent hover:bg-accent/10 transition-colors border border-accent/20">Receipt</button>
                      ) : <span className="text-gray-300">—</span>
                    }))}
                    emptyLabel={loading ? "Loading completed POs..." : "No completed POs in this range."}
                  />
                )}

                {pages.poTab === "deleted" && (
                  <DataTable
                    columns={[
                      { key: "po", label: "PO" },
                      { key: "vendor", label: "Vendor" },
                      { key: "type", label: "Type" },
                      { key: "deletedAt", label: "Deleted On" },
                      { key: "value", label: "Value", align: "right" as const },
                      { key: "status", label: "Status" }
                    ]}
                    rows={filteredDeleted.map((order) => ({
                      po: <span className="font-semibold text-gray-400 line-through">{order.poNumber ?? "—"}</span>,
                      vendor: <span className="text-gray-400">{order.vendor.name}</span>,
                      type: (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.type === "SUBCONTRACT" ? "bg-purple-50/50 text-purple-400 border border-purple-100" : "bg-blue-50/50 text-blue-400 border border-blue-100"
                          }`}>{order.type === "SUBCONTRACT" ? "Subcontract" : "Raw"}</span>
                      ),
                      deletedAt: order.deletedAt ? new Date(order.deletedAt).toLocaleDateString("en-IN") : "—",
                      value: <span className="font-medium text-gray-400">₹{order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>,
                      status: (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Deleted
                        </span>
                      )
                    }))}
                    emptyLabel={loading ? "Loading deleted POs..." : "No deleted POs."}
                  />
                )}
              </div>

              <p className="px-2 py-2 text-xs text-text-muted text-center border-t border-gray-100 mt-2">
                {(() => {
                  const counts: Record<string, number> = {
                    drafts: filteredDraft.length,
                    pending: filteredPending.length,
                    approved: filteredApproved.length,
                    completed: filteredReceived.length,
                    deleted: filteredDeleted.length,
                  };
                  return `${counts[pages.poTab] ?? 0} order${(counts[pages.poTab] ?? 0) !== 1 ? "s" : ""}`;
                })()}
              </p>
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

      <Card>
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1">
              {[
                { key: "all", label: "All", count: vendorBills.length },
                { key: "paid", label: "Paid", count: vendorBills.filter(b => b.status === "PAID").length },
                { key: "unpaid", label: "Unpaid", count: vendorBills.filter(b => b.status !== "PAID").length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPages((prev) => ({ ...prev, billTab: tab.key }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${(pages as Record<string, unknown>).billTab === tab.key || (!(pages as Record<string, unknown>).billTab && tab.key === "all")
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                    }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>
        <CardBody>
          <div className="max-h-[600px] overflow-y-auto">
            <DataTable
              columns={[
                { key: "bill", label: "Bill" },
                { key: "vendor", label: "Vendor" },
                { key: "sku", label: "SKU Name" },
                { key: "qty", label: "Qty" },
                { key: "unitPrice", label: "Unit Price", align: "right" },
                { key: "po", label: "PO" },
                { key: "billDate", label: "Bill Date" },
                { key: "dueDate", label: "Due Date" },
                { key: "total", label: "Total", align: "right" },
                { key: "balance", label: "Balance", align: "right" },
                { key: "status", label: "Status" },
                { key: "receipt", label: "" }
              ]}
              rows={[...vendorBills]
                .filter((bill) => {
                  if (pages.billTab === "paid") return bill.status === "PAID";
                  if (pages.billTab === "unpaid") return bill.status !== "PAID";
                  return true;
                })
                .sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime())
                .map((bill) => {
                  const isPaid = bill.status === "PAID";
                  const isOverdue = !isPaid && bill.dueDate && new Date(bill.dueDate) < new Date();
                  return {
                    bill: (
                      <span className="font-semibold text-accent">{bill.billNumber ?? "—"}</span>
                    ),
                    vendor: bill.vendor.name,
                    sku: summarizeBillSkus(bill.lines),
                    qty: summarizeBillQty(bill.lines),
                    unitPrice: summarizeBillUnitPrice(bill.lines),
                    po: (
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{bill.purchaseOrder?.poNumber ?? "—"}</span>
                    ),
                    billDate: new Date(bill.billDate).toLocaleDateString("en-IN"),
                    dueDate: bill.dueDate ? (
                      <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                        {new Date(bill.dueDate).toLocaleDateString("en-IN")}
                        {isOverdue && <span className="ml-1 text-[10px] text-red-500">Overdue</span>}
                      </span>
                    ) : "—",
                    total: (
                      <span className="font-medium">₹{bill.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    ),
                    balance: (
                      <span className={`font-medium ${bill.balanceAmount > 0 ? "text-red-600" : "text-green-600"}`}>
                        ₹{bill.balanceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    ),
                    status: (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isPaid
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-orange-50 text-orange-700 border border-orange-200"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-green-500" : "bg-orange-500"}`} />
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    ),
                    receipt: bill.receipt?.id ? (
                      <button
                        onClick={() => downloadReceipt(bill.receipt!.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                      >
                        Receipt
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )
                  };
                })}
              emptyLabel={loading ? "Loading bills..." : "No vendor bills yet."}
            />
          </div>
          <p className="px-2 py-2 text-xs text-text-muted text-center border-t border-gray-100">
            {(() => {
              const filtered = vendorBills.filter((b) => {
                if (pages.billTab === "paid") return b.status === "PAID";
                if (pages.billTab === "unpaid") return b.status !== "PAID";
                return true;
              });
              return `${filtered.length} bill${filtered.length !== 1 ? "s" : ""}`;
            })()}
          </p>

          <div className="mt-6 space-y-4">
            <p className="text-sm font-medium text-text">Record Vendor Payment</p>
            {billOptions.length ? (
              <div className="grid gap-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4 lg:grid-cols-2">
                <Select
                  label="Bill"
                  value={billPaymentId}
                  onChange={(event) => setBillPaymentId(event.target.value)}
                  options={billOptions}
                />
                <Input
                  label="Amount"
                  type="number"
                  value={billPaymentAmount}
                  onChange={(event) => setBillPaymentAmount(event.target.value)}
                />
                <Input
                  label="Payment Date"
                  type="date"
                  value={billPaymentDate}
                  onChange={(event) => setBillPaymentDate(event.target.value)}
                />
                <Input
                  label="Method"
                  value={billPaymentMethod}
                  onChange={(event) => setBillPaymentMethod(event.target.value)}
                />
                <Input
                  label="Reference"
                  value={billPaymentReference}
                  onChange={(event) => setBillPaymentReference(event.target.value)}
                />
                <Input
                  label="Notes"
                  value={billPaymentNotes}
                  onChange={(event) => setBillPaymentNotes(event.target.value)}
                />
                <div className="flex items-end">
                  <Button onClick={submitVendorPayment} disabled={billPaymentSubmitting}>
                    Record Payment
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">No unpaid vendor bills available.</p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
