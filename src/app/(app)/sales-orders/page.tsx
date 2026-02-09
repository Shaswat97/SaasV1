"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable, type DataColumn } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Tabs } from "@/components/Tabs";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type Customer = { id: string; code: string; name: string };

type FinishedSku = { id: string; code: string; name: string; unit: string; manufacturingCost?: number | null };

type Vendor = { id: string; code: string; name: string; vendorType?: string | null };

type SalesOrderLine = {
  id: string;
  skuId: string;
  sku: FinishedSku;
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  taxPct?: number | null;
  deliveredQty: number;
  producedQty: number;
  scrapQty: number;
  expectedRawCost?: number | null;
  actualRawCost?: number | null;
};

type SalesOrder = {
  id: string;
  soNumber?: string | null;
  status: string;
  customer: Customer;
  customerId: string;
  orderDate: string;
  currency: string;
  notes?: string | null;
  lines: SalesOrderLine[];
};

type Delivery = {
  id: string;
  salesOrderId: string;
  soLineId: string;
  quantity: number;
  deliveryDate: string;
  packagingCost: number;
  notes?: string | null;
  line: SalesOrderLine;
};

type InvoiceLine = {
  id: string;
  soLineId: string;
  skuId: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number | null;
  taxPct?: number | null;
};

type Invoice = {
  id: string;
  deliveryId?: string | null;
  invoiceNumber?: string | null;
  invoiceDate: string;
  status: string;
  lines: InvoiceLine[];
  delivery?: { packagingCost: number } | null;
};

type AvailabilitySummary = {
  finished: Array<{ skuId: string; skuCode: string; skuName: string; unit: string; onHand: number }>;
  raw: Array<{
    rawSkuId: string;
    rawSkuCode: string;
    rawSkuName: string;
    unit: string;
    requiredQty: number;
    onHandQty: number;
    onHandTotal: number;
    reservedQty: number;
    shortageQty: number;
  }>;
  lines: Array<{
    lineId: string;
    skuId: string;
    skuCode: string;
    skuName: string;
    unit: string;
    orderedQty: number;
    deliveredQty: number;
    finishedFromStock: number;
    productionRequired: number;
    bottleneckCapacity: number | null;
    estimatedMinutes: number | null;
    routingSteps: number;
    routingDetail: Array<{
      machineId: string;
      machineCode: string;
      machineName: string;
      capacityPerMinute: number;
      minutes: number | null;
    }>;
  }>;
};

type ProcurementPlan = {
  vendorPlans: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    lines: Array<{
      rawSkuId: string;
      rawSkuCode: string;
      rawSkuName: string;
      unit: string;
      shortageQty: number;
      unitPrice: number;
    }>;
    totalValue: number;
  }>;
  skipped: Array<{ rawSkuId: string; rawSkuCode: string; rawSkuName: string; reason: string }>;
};

type SalesOrderDetail = SalesOrder & {
  deliveries: Delivery[];
  invoices: Invoice[];
  availability: AvailabilitySummary;
  procurementPlan: ProcurementPlan;
};

type DraftLineForm = {
  skuId: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  taxPct: string;
};

type DeliveryFormLine = {
  lineId: string;
  sku: FinishedSku;
  openQty: number;
  qty: string;
  deliveryDate: string;
  packagingCost: string;
  notes: string;
};

type SubcontractLine = {
  lineId: string;
  sku: FinishedSku;
  openQty: number;
  qty: string;
  unitPrice: string;
};

function formatMinutesToClock(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const totalMinutes = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

const statusBadge: Record<string, { label: string; variant: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  OPEN: { label: "Open", variant: "neutral" },
  QUOTE: { label: "Quote", variant: "neutral" },
  CONFIRMED: { label: "Confirmed", variant: "info" },
  PRODUCTION: { label: "Production", variant: "warning" },
  DISPATCH: { label: "Dispatch", variant: "success" },
  DELIVERED: { label: "Delivered", variant: "success" },
  INVOICED: { label: "Invoiced", variant: "success" }
};

function lineNetTotal(line: { quantity: number; unitPrice: number; discountPct?: number | null; taxPct?: number | null }) {
  const discount = line.discountPct ?? 0;
  const tax = line.taxPct ?? 0;
  const discounted = line.unitPrice * (1 - discount / 100);
  return line.quantity * discounted * (1 + tax / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [skus, setSkus] = useState<FinishedSku[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const [customerId, setCustomerId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>("");
  const [lines, setLines] = useState<DraftLineForm[]>([]);

  const [detail, setDetail] = useState<SalesOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [focusSection, setFocusSection] = useState<"procurement" | null>(null);
  const procurementRef = useRef<HTMLDivElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRestoreRef = useRef<number | null>(null);
  const [subcontractVendorId, setSubcontractVendorId] = useState("");
  const [subcontractLines, setSubcontractLines] = useState<SubcontractLine[]>([]);
  const [deliveryLines, setDeliveryLines] = useState<DeliveryFormLine[]>([]);
  const [includePackagingInInvoice, setIncludePackagingInInvoice] = useState(true);

  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [customerData, skuData, vendorData, orderData] = await Promise.all([
        apiGet<Customer[]>("/api/customers"),
        apiGet<FinishedSku[]>("/api/finished-skus"),
        apiGet<Vendor[]>("/api/vendors"),
        apiGet<SalesOrder[]>("/api/sales-orders")
      ]);
      setCustomers(customerData);
      setSkus(skuData);
      setVendors(vendorData);
      setOrders(orderData);
      if (!customerId && customerData[0]) setCustomerId(customerData[0].id);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setNotes("");
    setOrderDate("");
    setLines([]);
  }

  function addLine() {
    if (!skus.length) {
      push("error", "Add finished SKUs before creating a sales order");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        skuId: skus[0].id,
        quantity: "",
        unitPrice: "",
        discountPct: "0",
        taxPct: "0"
      }
    ]);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();

    if (!customerId) {
      push("error", "Customer is required");
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
      taxPct: Number(line.taxPct || 0)
    }));

    if (payloadLines.some((line) => !line.skuId || line.quantity <= 0 || line.unitPrice <= 0)) {
      push("error", "Each line needs a SKU, quantity > 0, and unit price > 0");
      return;
    }

    try {
      const created = await apiSend<SalesOrder>("/api/sales-orders", "POST", {
        customerId,
        orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
        notes,
        lines: payloadLines
      });
      if (created.status === "CONFIRMED") {
        push("success", "Sales order confirmed and raw material aligned");
        openDetail(created.id);
      } else {
        push("success", "Sales order created as quote. Review raw availability to proceed.");
        setFocusSection("procurement");
        openDetail(created.id);
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to create sales order");
    }
  }

  async function openDetail(orderId: string) {
    setDetailLoading(true);
    if (detailScrollRef.current) {
      scrollRestoreRef.current = detailScrollRef.current.scrollTop;
    }
    try {
      const data = await apiGet<SalesOrderDetail>(`/api/sales-orders/${orderId}`);
      setDetail(data);
      const openDeliveries = data.lines
        .map((line) => ({
          lineId: line.id,
          sku: line.sku,
          openQty: Math.max(line.quantity - line.deliveredQty, 0),
          qty: "",
          deliveryDate: "",
          packagingCost: "0",
          notes: ""
        }))
        .filter((line) => line.openQty > 0);
      setDeliveryLines(openDeliveries);

      const subcontractDraft = data.lines
        .map((line) => {
          const openQty = Math.max(line.quantity - (line.producedQty ?? 0) - (line.deliveredQty ?? 0), 0);
          return {
            lineId: line.id,
            sku: line.sku,
            openQty,
            qty: openQty > 0 ? String(openQty) : "",
            unitPrice: line.sku.manufacturingCost ? String(line.sku.manufacturingCost) : "0"
          };
        })
        .filter((line) => line.openQty > 0);
      setSubcontractLines(subcontractDraft);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load sales order");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (detail && focusSection === "procurement") {
      procurementRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setFocusSection(null);
    }
  }, [detail, focusSection]);

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: `${customer.code} · ${customer.name}` })),
    [customers]
  );

  const skuOptions = useMemo(
    () => skus.map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name}` })),
    [skus]
  );

  const missingRoutingLines = useMemo(() => {
    if (!detail) return [];
    return detail.availability.lines.filter(
      (line) => line.productionRequired > 0 && (line.bottleneckCapacity == null || line.estimatedMinutes == null)
    );
  }, [detail]);

  const machineRuntimeSummary = useMemo(() => {
    if (!detail) return { items: [], missing: false };
    const map = new Map<string, { machineCode: string; machineName: string; minutes: number }>();
    let missing = false;
    detail.availability.lines.forEach((line) => {
      if (line.productionRequired > 0 && (!line.routingDetail || line.routingDetail.length === 0)) {
        missing = true;
      }
      line.routingDetail?.forEach((step) => {
        if (step.minutes == null) {
          missing = true;
          return;
        }
        const current = map.get(step.machineId);
        map.set(step.machineId, {
          machineCode: step.machineCode,
          machineName: step.machineName,
          minutes: (current?.minutes ?? 0) + step.minutes
        });
      });
    });
    const items = Array.from(map.values()).sort((a, b) => a.minutes - b.minutes);
    return { items, missing };
  }, [detail]);

  const machineOptionsBySku = useMemo(() => {
    if (!detail) return [];
    return detail.availability.lines
      .filter((line) => line.productionRequired > 0)
      .map((line) => {
        const options = (line.routingDetail ?? [])
          .map((step) => ({
            machineId: step.machineId,
            machineCode: step.machineCode,
            machineName: step.machineName,
            capacityPerMinute: step.capacityPerMinute,
            minutes: step.minutes ?? 0
          }))
          .filter((step) => step.capacityPerMinute > 0)
          .sort((a, b) => a.minutes - b.minutes);
        return {
          lineId: line.lineId,
          skuCode: line.skuCode,
          skuName: line.skuName,
          unit: line.unit,
          productionRequired: line.productionRequired,
          options,
          fastest: options[0] ?? null
        };
      });
  }, [detail]);

  const materialVarianceSummary = useMemo(() => {
    if (!detail) return null;
    const expected = detail.lines.reduce((sum, line) => sum + (line.expectedRawCost ?? 0), 0);
    const actual = detail.lines.reduce((sum, line) => sum + (line.actualRawCost ?? 0), 0);
    if (expected <= 0) return null;
    const delta = actual - expected;
    const pct = (delta / expected) * 100;
    return { expected, actual, delta, pct };
  }, [detail]);

  const deliveryLinesWithQty = useMemo(
    () => deliveryLines.filter((line) => Number(line.qty) > 0),
    [deliveryLines]
  );

  const canPrintInvoice = useMemo(
    () => deliveryLinesWithQty.length > 0 && deliveryLinesWithQty.every((line) => Boolean(line.deliveryDate)),
    [deliveryLinesWithQty]
  );

  const subcontractVendorOptions = useMemo(
    () =>
      vendors
        .filter((vendor) => (vendor.vendorType ?? "RAW") === "SUBCONTRACT")
        .map((vendor) => ({ value: vendor.id, label: `${vendor.code} · ${vendor.name}` })),
    [vendors]
  );

  useEffect(() => {
    if (detail && subcontractVendorOptions.length && !subcontractVendorId) {
      setSubcontractVendorId(subcontractVendorOptions[0].value);
    }
  }, [detail, subcontractVendorOptions, subcontractVendorId]);

  useEffect(() => {
    if (!detail) return;
    if (scrollRestoreRef.current === null) return;
    const top = scrollRestoreRef.current;
    scrollRestoreRef.current = null;
    requestAnimationFrame(() => {
      detailScrollRef.current?.scrollTo({ top });
    });
  }, [detail]);

  async function updateStatus(order: SalesOrder, action: "confirm" | "production" | "dispatch") {
    try {
      await apiSend(`/api/sales-orders/${order.id}/${action}`, "POST");
      push("success", "Order status updated");
      loadData();
      if (detail?.id === order.id) {
        openDetail(order.id);
      }
    } catch (error: any) {
      const message = error.message ?? "Failed to update status";
      if (action === "confirm" && message.toLowerCase().includes("insufficient raw")) {
        push("error", "Insufficient raw material. Review the procurement plan and create a draft PO.");
        setFocusSection("procurement");
        openDetail(order.id);
        return;
      }
      push("error", message);
    }
  }

  async function createDraftPo() {
    if (!detail) return;
    try {
      await apiSend(`/api/sales-orders/${detail.id}/procure`, "POST");
      push("success", "Draft purchase order created");
      openDetail(detail.id);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to create draft PO");
    }
  }

  async function createDraftPoForOrder(orderId: string) {
    try {
      await apiSend(`/api/sales-orders/${orderId}/procure`, "POST");
      push("success", "Draft purchase order created");
      openDetail(orderId);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to create draft PO");
    }
  }

  async function markDelivered(orderId: string) {
    try {
      await apiSend(`/api/sales-orders/${orderId}/delivered`, "POST");
      push("success", "Order marked delivered");
      loadData();
      if (detail?.id === orderId) {
        openDetail(orderId);
      }
    } catch (error: any) {
      push("error", error.message ?? "Failed to mark delivered");
    }
  }

  async function createSubcontractPo() {
    if (!detail) return;
    if (!subcontractVendorId) {
      push("error", "Select a subcontractor");
      return;
    }
    const payloadLines = subcontractLines
      .filter((line) => Number(line.qty) > 0)
      .map((line) => ({
        lineId: line.lineId,
        quantity: Number(line.qty),
        unitPrice: Number(line.unitPrice)
      }));
    if (!payloadLines.length) {
      push("error", "Enter quantities to subcontract");
      return;
    }

    try {
      await apiSend(`/api/sales-orders/${detail.id}/subcontract`, "POST", {
        vendorId: subcontractVendorId,
        lines: payloadLines
      });
      push("success", "Subcontract PO created");
      openDetail(detail.id);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to create subcontract PO");
    }
  }

  async function submitDeliveries(autoInvoice = false) {
    if (!detail) return;
    const existingDeliveryIds = new Set(detail.deliveries.map((delivery) => delivery.id));
    const payloadLines = deliveryLines
      .filter((line) => Number(line.qty) > 0)
      .map((line) => ({
        lineId: line.lineId,
        quantity: Number(line.qty),
        packagingCost: Number(line.packagingCost || 0),
        deliveryDate: line.deliveryDate ? new Date(line.deliveryDate).toISOString() : undefined,
        notes: line.notes || undefined
      }));

    if (payloadLines.length === 0) {
      push("error", "Enter quantities to deliver");
      return;
    }

    const invalid = deliveryLines.some((line) => Number(line.qty) > line.openQty);
    if (invalid) {
      push("error", "Delivery quantity cannot exceed open quantity");
      return;
    }

    try {
      const updated = await apiSend<SalesOrderDetail>(`/api/sales-orders/${detail.id}/deliveries`, "POST", {
        lines: payloadLines
      });
      push("success", "Delivery recorded");
      if (autoInvoice) {
        const newDeliveries = updated.deliveries.filter((delivery) => !existingDeliveryIds.has(delivery.id));
        for (const delivery of newDeliveries) {
          try {
            const invoice = await apiSend<Invoice>(
              `/api/sales-orders/${updated.id}/deliveries/${delivery.id}/invoice`,
              "POST"
            );
            downloadInvoicePdf(invoice.id, includePackagingInInvoice);
          } catch (error: any) {
            push("error", error.message ?? "Failed to create invoice");
          }
        }
      }
      openDetail(detail.id);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to record delivery");
    }
  }

  async function createInvoiceForDelivery(deliveryId: string) {
    if (!detail) return;
    try {
      const invoice = await apiSend<Invoice>(`/api/sales-orders/${detail.id}/deliveries/${deliveryId}/invoice`, "POST");
      push("success", "Invoice created");
      openDetail(detail.id);
      loadData();
      downloadInvoicePdf(invoice.id, includePackagingInInvoice);
    } catch (error: any) {
      push("error", error.message ?? "Failed to create invoice");
    }
  }

  function downloadInvoicePdf(invoiceId: string, includePackaging = includePackagingInInvoice) {
    const param = includePackaging ? "1" : "0";
    window.open(`/api/sales-orders/invoices/${invoiceId}/pdf?includePackaging=${param}`, "_blank");
  }

  function buildOrderRows(source: SalesOrder[]) {
    return source.map((order) => {
      const badge = statusBadge[order.status] ?? { label: order.status, variant: "neutral" };
      return {
        so: order.soNumber ?? "—",
        customer: order.customer.name,
        value: order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0).toFixed(2),
        status: <Badge {...badge} />,
        date: formatDate(order.orderDate),
        actions: (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setFocusSection(null);
                openDetail(order.id);
              }}
            >
              View
            </Button>
            {order.status === "QUOTE" ? (
              <>
                <Button variant="ghost" onClick={() => createDraftPoForOrder(order.id)}>
                  Draft PO
                </Button>
                <Button variant="ghost" onClick={() => updateStatus(order, "confirm")}>
                  Confirm
                </Button>
              </>
            ) : null}
            {order.status === "CONFIRMED" ? (
              <Button variant="ghost" onClick={() => updateStatus(order, "production")}>
                Start Production
              </Button>
            ) : null}
            {order.status === "PRODUCTION" ? (
              <Button variant="ghost" onClick={() => updateStatus(order, "dispatch")}>
                Dispatch
              </Button>
            ) : null}
            {order.status === "DISPATCH" ? (
              <Button
                variant="ghost"
                onClick={() => markDelivered(order.id)}
                disabled={!order.lines.every((line) => (line.deliveredQty ?? 0) >= line.quantity)}
              >
                Mark Delivered
              </Button>
            ) : null}
          </div>
        )
      };
    });
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    orders.forEach((order) => {
      counts[order.status] = (counts[order.status] ?? 0) + 1;
    });
    return counts;
  }, [orders]);

  const statusTabs = useMemo(() => {
    const columns: DataColumn[] = [
      { key: "so", label: "Order" },
      { key: "customer", label: "Customer" },
      { key: "value", label: "Value", align: "right" },
      { key: "status", label: "Status" },
      { key: "date", label: "Date" },
      { key: "actions", label: "" }
    ];

    const buildContent = (items: SalesOrder[]) => (
      <DataTable
        columns={columns}
        rows={buildOrderRows(items)}
        emptyLabel={loading ? "Loading orders..." : "No orders found."}
      />
    );

    return [
      { label: `All (${statusCounts.all ?? 0})`, value: "all", content: buildContent(orders) },
      { label: `Quote (${statusCounts.QUOTE ?? 0})`, value: "QUOTE", content: buildContent(orders.filter((o) => o.status === "QUOTE")) },
      { label: `Confirmed (${statusCounts.CONFIRMED ?? 0})`, value: "CONFIRMED", content: buildContent(orders.filter((o) => o.status === "CONFIRMED")) },
      { label: `Production (${statusCounts.PRODUCTION ?? 0})`, value: "PRODUCTION", content: buildContent(orders.filter((o) => o.status === "PRODUCTION")) },
      { label: `Dispatch (${statusCounts.DISPATCH ?? 0})`, value: "DISPATCH", content: buildContent(orders.filter((o) => o.status === "DISPATCH")) },
      { label: `Delivered (${statusCounts.DELIVERED ?? 0})`, value: "DELIVERED", content: buildContent(orders.filter((o) => o.status === "DELIVERED")) },
      { label: `Invoiced (${statusCounts.INVOICED ?? 0})`, value: "INVOICED", content: buildContent(orders.filter((o) => o.status === "INVOICED")) }
    ];
  }, [orders, statusCounts, loading]);

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Sales Orders"
        subtitle="Track quotes, production milestones, and delivery commitments."
        actions={
          <Button variant="secondary" onClick={addLine}>
            Add Line
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create Sales Order</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleCreate}>
              <Select
                label="Customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                options={customerOptions}
                required
              />
              <Input
                label="Order Date"
                type="date"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
              />
              <Input
                label="Notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Commercial terms, delivery notes"
              />

              <div className="space-y-3">
                {lines.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted">
                    Add sales order lines to begin.
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
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, skuId: value } : item))
                            );
                          }}
                          options={skuOptions}
                        />
                        <Input
                          label="Quantity"
                          type="number"
                          value={line.quantity}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, quantity: value } : item))
                            );
                          }}
                          required
                        />
                        <Input
                          label="Unit Price"
                          type="number"
                          value={line.unitPrice}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, unitPrice: value } : item))
                            );
                          }}
                          required
                        />
                        <Input
                          label="Discount %"
                          type="number"
                          value={line.discountPct}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, discountPct: value } : item))
                            );
                          }}
                        />
                        <Input
                          label="Tax %"
                          type="number"
                          value={line.taxPct}
                          onChange={(event) => {
                            const value = event.target.value;
                            setLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, taxPct: value } : item))
                            );
                          }}
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button variant="ghost" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== index))}>
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
                <Button type="submit">Create Order</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardBody>
            <Tabs items={statusTabs} defaultValue="all" />
          </CardBody>
        </Card>
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Sales Order ${detail.soNumber ?? detail.id}` : "Sales Order"}
        className="max-w-5xl"
        scrollRef={detailScrollRef}
      >
        {detailLoading || !detail ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Overview</p>
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    <span className="text-text-muted">Customer:</span> {detail.customer.name}
                  </p>
                  <p>
                    <span className="text-text-muted">Status:</span> {detail.status}
                  </p>
                  <p>
                    <span className="text-text-muted">Order Date:</span> {formatDate(detail.orderDate)}
                  </p>
                  {detail.notes ? <p>{detail.notes}</p> : null}
                </div>
                {detail.status === "DISPATCH" ? (
                  <div className="mt-4">
                    <Button
                      onClick={() => markDelivered(detail.id)}
                      disabled={!detail.lines.every((line) => (line.deliveredQty ?? 0) >= line.quantity)}
                    >
                      Mark Delivered
                    </Button>
                    {!detail.lines.every((line) => (line.deliveredQty ?? 0) >= line.quantity) ? (
                      <p className="mt-2 text-xs text-text-muted">All lines must be delivered first.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Availability Summary</p>
                <div className="mt-3 grid gap-3 text-sm">
                  <div>
                    <p className="text-text-muted">Finished Stock On Hand</p>
                    <p className="text-lg font-semibold text-text">
                      {detail.availability.finished.reduce((sum, sku) => sum + sku.onHand, 0)} units
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Raw Shortage</p>
                    <p className="text-lg font-semibold text-text">
                      {detail.availability.raw.reduce((sum, sku) => sum + sku.shortageQty, 0)} units
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Estimated Production Time (best machine per SKU)</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-text">
                        {(() => {
                          const total = detail.availability.lines.reduce(
                            (sum, line) => sum + (line.estimatedMinutes ?? 0),
                            0
                          );
                          return missingRoutingLines.length ? "Missing routing" : formatMinutesToClock(total);
                        })()}
                      </p>
                      {missingRoutingLines.length ? <Badge variant="warning" label="Routing missing" /> : null}
                    </div>
                    {missingRoutingLines.length ? (
                      <div className="mt-2 text-xs text-text-muted">
                        Missing routing for:{" "}
                        {missingRoutingLines.map((line) => `${line.skuCode} · ${line.skuName}`).join(", ")}.
                        <div className="mt-1">Map in Settings &gt; Master Data &gt; Finished SKUs &gt; Routing Steps.</div>
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            onClick={() => router.push("/settings/master-data/finished-skus")}
                          >
                            Map Routing
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-text-muted">Material Variance (Burn %)</p>
                    {materialVarianceSummary ? (
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-lg font-semibold text-text">
                          {materialVarianceSummary.pct >= 0 ? "+" : ""}
                          {materialVarianceSummary.pct.toFixed(1)}%
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatCurrency(materialVarianceSummary.actual, detail.currency ?? "INR")} actual ·{" "}
                          {formatCurrency(materialVarianceSummary.expected, detail.currency ?? "INR")} expected
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-text-muted">Machine Options Summary</p>
                    <p className="text-sm text-text">
                      {machineRuntimeSummary.items.length
                        ? `${machineRuntimeSummary.items.length} machine${machineRuntimeSummary.items.length > 1 ? "s" : ""}`
                        : "No routing yet"}
                    </p>
                    {machineRuntimeSummary.items.length ? (
                      <div className="mt-2 space-y-1 text-xs text-text-muted">
                        {machineRuntimeSummary.items.map((item) => (
                          <div key={`${item.machineCode}-${item.machineName}`} className="flex justify-between gap-3">
                            <span className="text-text">{item.machineCode} · {item.machineName}</span>
                            <span>{formatMinutesToClock(item.minutes)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {machineRuntimeSummary.missing ? (
                      <p className="mt-2 text-xs text-warning">Some machine capacities are missing for this order.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {machineOptionsBySku.length ? (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Machine Options by SKU</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-4">
                      {machineOptionsBySku.map((item) => (
                        <div
                          key={item.lineId}
                          className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-text">
                                {item.skuCode} · {item.skuName}
                              </p>
                              <p className="text-xs text-text-muted">
                                Production required: {item.productionRequired} {item.unit}
                              </p>
                            </div>
                            {item.fastest ? (
                              <Badge variant="success" label={`Fastest: ${item.fastest.machineCode}`} />
                            ) : (
                              <Badge variant="warning" label="Routing missing" />
                            )}
                          </div>
                          {item.options.length ? (
                            <div className="mt-3 grid gap-2 text-xs text-text-muted">
                              {item.options.map((option) => (
                                <div
                                  key={`${item.lineId}-${option.machineId}`}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="text-text">
                                    {option.machineCode} · {option.machineName}
                                  </span>
                                  <span>{formatMinutesToClock(option.minutes)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-text-muted">
                              No machine options mapped for this SKU yet.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ) : null}
              <Card>
                <CardHeader>
                  <CardTitle>Finished Availability</CardTitle>
                </CardHeader>
                <CardBody>
                  <DataTable
                    columns={[
                      { key: "sku", label: "SKU" },
                      { key: "ordered", label: "Ordered", align: "right" },
                      { key: "delivered", label: "Delivered", align: "right" },
                      { key: "stock", label: "From Stock", align: "right" },
                      { key: "production", label: "Production", align: "right" },
                      { key: "capacity", label: "Bottleneck (u/min)", align: "right" },
                      { key: "minutes", label: "Est. Time (HH:MM)", align: "right" }
                    ]}
                    rows={detail.availability.lines.map((line) => ({
                      sku: `${line.skuCode} · ${line.skuName}`,
                      ordered: `${line.orderedQty} ${line.unit}`,
                      delivered: `${line.deliveredQty} ${line.unit}`,
                      stock: `${line.finishedFromStock} ${line.unit}`,
                      production: `${line.productionRequired} ${line.unit}`,
                      capacity:
                        line.bottleneckCapacity != null
                          ? line.bottleneckCapacity.toFixed(2).replace(/\.00$/, "")
                          : "Missing",
                      minutes:
                        line.estimatedMinutes != null
                          ? formatMinutesToClock(line.estimatedMinutes)
                          : "—"
                    }))}
                    emptyLabel="No availability data."
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Raw Requirement</CardTitle>
                </CardHeader>
                <CardBody>
                  <DataTable
                    columns={[
                      { key: "sku", label: "Raw SKU" },
                      { key: "required", label: "Required", align: "right" },
                      { key: "free", label: "Free", align: "right" },
                      { key: "reserved", label: "Reserved", align: "right" },
                      { key: "total", label: "Total", align: "right" },
                      { key: "short", label: "Shortage", align: "right" }
                    ]}
                    rows={detail.availability.raw.map((raw) => ({
                      sku: `${raw.rawSkuCode} · ${raw.rawSkuName}`,
                      required: `${raw.requiredQty} ${raw.unit}`,
                      free: `${raw.onHandQty} ${raw.unit}`,
                      reserved: `${raw.reservedQty} ${raw.unit}`,
                      total: `${raw.onHandTotal} ${raw.unit}`,
                      short: `${raw.shortageQty} ${raw.unit}`
                    }))}
                    emptyLabel="No raw requirements."
                  />
                </CardBody>
              </Card>
            </div>

            <div ref={procurementRef}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Procurement Plan</CardTitle>
                    {detail.procurementPlan.vendorPlans.length ? (
                      <Button variant="secondary" onClick={createDraftPo}>
                        Create Draft PO
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardBody>
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Raw Availability (Free vs Reserved)</p>
                  <div className="mt-3">
                    <DataTable
                      columns={[
                        { key: "sku", label: "Raw SKU" },
                        { key: "total", label: "Total", align: "right" },
                        { key: "reserved", label: "Reserved", align: "right" },
                        { key: "free", label: "Free", align: "right" },
                        { key: "short", label: "Shortage", align: "right" }
                      ]}
                      rows={detail.availability.raw.map((raw) => ({
                        sku: `${raw.rawSkuCode} · ${raw.rawSkuName}`,
                        total: `${raw.onHandTotal} ${raw.unit}`,
                        reserved: `${raw.reservedQty} ${raw.unit}`,
                        free: `${raw.onHandQty} ${raw.unit}`,
                        short: `${raw.shortageQty} ${raw.unit}`
                      }))}
                      emptyLabel="No raw availability data."
                    />
                  </div>
                </div>
                {detail.procurementPlan.vendorPlans.length ? (
                  <div className="space-y-4">
                    {detail.procurementPlan.vendorPlans.map((plan) => (
                      <div key={plan.vendorId} className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{plan.vendorCode} · {plan.vendorName}</p>
                            <p className="text-xs text-text-muted">Draft PO value ₹{plan.totalValue.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <DataTable
                            columns={[
                              { key: "sku", label: "Raw SKU" },
                              { key: "qty", label: "Shortage", align: "right" },
                              { key: "price", label: "Unit Price", align: "right" },
                              { key: "value", label: "Value", align: "right" }
                            ]}
                            rows={plan.lines.map((line) => ({
                              sku: `${line.rawSkuCode} · ${line.rawSkuName}`,
                              qty: `${line.shortageQty} ${line.unit}`,
                              price: line.unitPrice ? line.unitPrice.toFixed(2) : "—",
                              value: (line.shortageQty * line.unitPrice).toFixed(2)
                            }))}
                            emptyLabel="No items for this vendor."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-bg-subtle/60 p-4 text-sm text-text-muted">
                    No draft PO needed based on current availability.
                  </div>
                )}
                {detail.procurementPlan.skipped.length ? (
                  <div className="mt-4 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Skipped Items</p>
                    <ul className="mt-3 space-y-2 text-sm text-text-muted">
                      {detail.procurementPlan.skipped.map((item) => (
                        <li key={item.rawSkuId}>
                          {item.rawSkuCode} · {item.rawSkuName} — {item.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Subcontracting</CardTitle>
                  <Button variant="secondary" onClick={createSubcontractPo} disabled={!subcontractVendorId || !subcontractLines.length}>
                    Create Subcontract PO
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                {subcontractVendorOptions.length ? (
                  <div className="space-y-4">
                    <Select
                      label="Subcontractor"
                      value={subcontractVendorId}
                      onChange={(event) => setSubcontractVendorId(event.target.value)}
                      options={subcontractVendorOptions}
                    />
                    {subcontractLines.length ? (
                      <div className="space-y-3">
                        {subcontractLines.map((line, index) => (
                          <div
                            key={line.lineId}
                            className="grid gap-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-3 lg:grid-cols-[2fr_1fr_1fr_1fr]"
                          >
                            <div>
                              <p className="text-sm font-medium">{line.sku.code} · {line.sku.name}</p>
                              <p className="text-xs text-text-muted">Open: {line.openQty} {line.sku.unit}</p>
                            </div>
                            <Input
                              label="Subcontract Qty"
                              type="number"
                              value={line.qty}
                              onChange={(event) => {
                                const value = event.target.value;
                                setSubcontractLines((prev) =>
                                  prev.map((item, idx) => (idx === index ? { ...item, qty: value } : item))
                                );
                              }}
                            />
                            <Input
                              label="Unit Price"
                              type="number"
                              value={line.unitPrice}
                              onChange={(event) => {
                                const value = event.target.value;
                                setSubcontractLines((prev) =>
                                  prev.map((item, idx) => (idx === index ? { ...item, unitPrice: value } : item))
                                );
                              }}
                            />
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setSubcontractLines((prev) => prev.filter((_, idx) => idx !== index))
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-bg-subtle/60 p-4 text-sm text-text-muted">
                        No open quantities left to subcontract.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-bg-subtle/60 p-4 text-sm text-text-muted">
                    No subcontract vendors yet. Create a vendor with type Subcontractor.
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lines & Production Metrics</CardTitle>
              </CardHeader>
              <CardBody>
                <DataTable
                  columns={[
                    { key: "sku", label: "SKU" },
                    { key: "ordered", label: "Ordered", align: "right" },
                    { key: "delivered", label: "Delivered", align: "right" },
                    { key: "produced", label: "Produced", align: "right" },
                    { key: "scrap", label: "Scrap", align: "right" },
                    { key: "yield", label: "Yield", align: "right" }
                  ]}
                  rows={detail.lines.map((line) => {
                    const total = line.producedQty + line.scrapQty;
                    const yieldPct = total > 0 ? `${((line.producedQty / total) * 100).toFixed(1)}%` : "—";
                    return {
                      sku: `${line.sku.code} · ${line.sku.name}`,
                      ordered: `${line.quantity} ${line.sku.unit}`,
                      delivered: `${line.deliveredQty} ${line.sku.unit}`,
                      produced: `${line.producedQty} ${line.sku.unit}`,
                      scrap: `${line.scrapQty} ${line.sku.unit}`,
                      yield: yieldPct
                    };
                  })}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deliveries</CardTitle>
              </CardHeader>
              <CardBody>
                <DataTable
                  columns={[
                    { key: "date", label: "Date" },
                    { key: "sku", label: "SKU" },
                    { key: "qty", label: "Qty", align: "right" },
                    { key: "packaging", label: "Packaging", align: "right" },
                    { key: "notes", label: "Notes" },
                    { key: "actions", label: "" }
                  ]}
                  rows={detail.deliveries.map((delivery) => ({
                    date: formatDate(delivery.deliveryDate),
                    sku: `${delivery.line.sku.code} · ${delivery.line.sku.name}`,
                    qty: `${delivery.quantity} ${delivery.line.sku.unit}`,
                    packaging: delivery.packagingCost ? delivery.packagingCost.toFixed(2) : "—",
                    notes: delivery.notes ?? "—",
                    actions: detail.invoices.some((invoice) => invoice.deliveryId === delivery.id) ? (
                      "Invoiced"
                    ) : (
                      <Button variant="ghost" onClick={() => createInvoiceForDelivery(delivery.id)}>
                        Create Invoice
                      </Button>
                    )
                  }))}
                  emptyLabel="No deliveries recorded yet."
                />
                {deliveryLines.length ? (
                  <div className="mt-6 space-y-4">
                    <p className="text-sm font-medium text-text">Record Delivery</p>
                    <div className="space-y-3">
                      {deliveryLines.map((line, index) => (
                        <div
                          key={line.lineId}
                          className="grid gap-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
                        >
                          <div>
                            <p className="text-sm font-medium">{line.sku.code} · {line.sku.name}</p>
                            <p className="text-xs text-text-muted">Open: {line.openQty} {line.sku.unit}</p>
                          </div>
                          <Input
                            label="Qty"
                            type="number"
                            value={line.qty}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDeliveryLines((prev) =>
                                prev.map((item, idx) => (idx === index ? { ...item, qty: value } : item))
                              );
                            }}
                          />
                          <Input
                            label="Packaging Cost"
                            type="number"
                            value={line.packagingCost}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDeliveryLines((prev) =>
                                prev.map((item, idx) => (idx === index ? { ...item, packagingCost: value } : item))
                              );
                            }}
                          />
                          <Input
                            label="Delivery Date"
                            type="date"
                            value={line.deliveryDate}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDeliveryLines((prev) =>
                                prev.map((item, idx) => (idx === index ? { ...item, deliveryDate: value } : item))
                              );
                            }}
                          />
                          <Input
                            label="Notes"
                            value={line.notes}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDeliveryLines((prev) =>
                                prev.map((item, idx) => (idx === index ? { ...item, notes: value } : item))
                              );
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-text-muted">
                      <input
                        type="checkbox"
                        checked={includePackagingInInvoice}
                        onChange={(event) => setIncludePackagingInInvoice(event.target.checked)}
                      />
                      Include logistics/packaging cost in invoice PDF
                    </label>
                    {!canPrintInvoice && deliveryLinesWithQty.length ? (
                      <p className="text-xs text-text-muted">
                        Add a delivery date to enable invoice printing.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => submitDeliveries()}>Post Delivery</Button>
                      <Button
                        variant="secondary"
                        disabled={!canPrintInvoice}
                        onClick={() => submitDeliveries(true)}
                      >
                        Post Delivery + Print Invoice
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <CardBody>
                <DataTable
                  columns={[
                    { key: "invoice", label: "Invoice" },
                    { key: "date", label: "Date" },
                    { key: "delivery", label: "Delivery" },
                    { key: "lines", label: "Lines", align: "right" },
                    { key: "packaging", label: "Packaging", align: "right" },
                    { key: "value", label: "Value", align: "right" },
                    { key: "actions", label: "" }
                  ]}
                  rows={detail.invoices.map((invoice) => ({
                    invoice: invoice.invoiceNumber ?? "—",
                    date: formatDate(invoice.invoiceDate),
                    delivery: invoice.deliveryId ? "Delivery-linked" : "—",
                    lines: invoice.lines.length,
                    packaging: invoice.delivery?.packagingCost ? invoice.delivery.packagingCost.toFixed(2) : "—",
                    value: (
                      invoice.lines.reduce((sum, line) => sum + lineNetTotal(line), 0) +
                      (invoice.delivery?.packagingCost ?? 0)
                    ).toFixed(2),
                    actions: (
                      <Button variant="ghost" onClick={() => downloadInvoicePdf(invoice.id)}>
                        Download PDF
                      </Button>
                    )
                  }))}
                  emptyLabel="No invoices yet."
                />
              </CardBody>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
