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
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DateFilter, getPresetRange } from "@/components/DateFilter";
import type { DateRange } from "@/components/DateFilter";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  MessageSquare,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Package,
  ShoppingCart,
  Users,
  CheckCircle2,
  ArrowUp
} from "lucide-react";

type Customer = {
  id: string;
  code: string;
  name: string;
  creditDays?: number | null;
  remindBeforeDays?: number | null;
};

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
  creditDays?: number | null;
  remindBeforeDays?: number | null;
  currency: string;
  notes?: string | null;
  lines: SalesOrderLine[];
  payment?: {
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    status: "NOT_BILLED" | "UNPAID" | "PARTIALLY_PAID" | "PAID";
    nextDueDate?: string | null;
    oldestOverdueDate?: string | null;
    openInvoiceCount?: number;
    overdueInvoiceCount?: number;
  };
  canUseFinishedStock?: boolean;
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
  sku: { code: string; name: string; unit: string };
};

type Invoice = {
  id: string;
  deliveryId?: string | null;
  invoiceNumber?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
  totalAmount?: number | null;
  balanceAmount?: number | null;
  lines: InvoiceLine[];
  delivery?: { packagingCost: number } | null;
  payments?: Array<{
    id: string;
    amount: number;
    payment: {
      id: string;
      paymentDate: string;
      amount: number;
      method?: string | null;
      reference?: string | null;
      notes?: string | null;
    };
  }>;
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

type LastPriceInfo = {
  source: "invoice" | "order";
  unitPrice: number;
  discountPct?: number | null;
  taxPct?: number | null;
  currency?: string | null;
  date?: string | null;
  soNumber?: string | null;
} | null;

type PriceListQuoteInfo = {
  source: "price_list";
  unitPrice: number;
  discountPct?: number | null;
  taxPct?: number | null;
  minQty?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  priceList?: { id: string; code?: string | null; name: string } | null;
} | null;

type DeliveryFormLine = {
  lineId: string;
  sku: FinishedSku;
  openQty: number;
  maxDispatchableQty: number;
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

function formatCurrencyCompact(value: number, currency = "INR") {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1
    }).format(value);
  } catch {
    return formatCurrency(value, currency);
  }
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

function computeInvoiceTotals(invoice: Invoice) {
  const total =
    invoice.totalAmount ??
    (invoice.lines.reduce((sum, line) => sum + lineNetTotal(line), 0) + (invoice.delivery?.packagingCost ?? 0));
  const storedBalance = invoice.balanceAmount;
  let balance =
    storedBalance == null ? total : storedBalance === 0 && invoice.status === "ISSUED" ? total : storedBalance;
  // Guard against floating-point residue like 0.0000001 showing as "0.00" but still treated as unpaid.
  if (Math.abs(balance) < 0.005) balance = 0;
  return { total, balance };
}

function deriveInvoicePaymentStatus(invoice: Invoice) {
  const { total, balance } = computeInvoiceTotals(invoice);
  if (balance <= 0) return "PAID";
  if (balance >= total - 0.005) {
    return invoice.status === "ISSUED" ? "ISSUED" : "UNPAID";
  }
  return "PARTIALLY_PAID";
}

function formatInvoicePaymentStatus(status?: string | null) {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PARTIALLY_PAID":
      return "Partially Paid";
    case "UNPAID":
      return "Unpaid";
    case "ISSUED":
      return "Issued";
    default:
      return status ? status.replaceAll("_", " ") : "Unpaid";
  }
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
  const [orderCreditDays, setOrderCreditDays] = useState("0");
  const [orderRemindBeforeDays, setOrderRemindBeforeDays] = useState("3");
  const [notes, setNotes] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>("");
  const [lines, setLines] = useState<DraftLineForm[]>([]);
  const [lastPriceMap, setLastPriceMap] = useState<Record<string, LastPriceInfo>>({});
  const [priceListMap, setPriceListMap] = useState<Record<string, PriceListQuoteInfo>>({});

  const [detail, setDetail] = useState<SalesOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [focusSection, setFocusSection] = useState<"procurement" | "deliveries" | null>(null);
  const procurementRef = useRef<HTMLDivElement | null>(null);
  const deliveriesRef = useRef<HTMLDivElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRestoreRef = useRef<number | null>(null);
  const [subcontractVendorId, setSubcontractVendorId] = useState("");
  const [subcontractLines, setSubcontractLines] = useState<SubcontractLine[]>([]);
  const [deliveryLines, setDeliveryLines] = useState<DeliveryFormLine[]>([]);
  const [includePackagingInInvoice, setIncludePackagingInInvoice] = useState(true);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentBoxExpanded, setPaymentBoxExpanded] = useState(true);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeNotes, setChargeNotes] = useState("");
  const [chargeSubmitting, setChargeSubmitting] = useState(false);

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
      if (!customerId && customerData[0]) {
        setCustomerId(customerData[0].id);
        setOrderCreditDays(String(customerData[0].creditDays ?? 0));
        setOrderRemindBeforeDays(String(customerData[0].remindBeforeDays ?? 3));
      }
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

  useEffect(() => {
    setLastPriceMap({});
    setPriceListMap({});
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    const skuIds = Array.from(new Set(lines.map((line) => line.skuId).filter(Boolean)));
    skuIds.forEach(async (skuId) => {
      const key = `${customerId}:${skuId}`;
      if (Object.prototype.hasOwnProperty.call(lastPriceMap, key)) return;
      try {
        const info = await apiGet<LastPriceInfo>(
          `/api/sales-orders/last-price?customerId=${encodeURIComponent(customerId)}&skuId=${encodeURIComponent(skuId)}`
        );
        setLastPriceMap((prev) => ({ ...prev, [key]: info }));
      } catch {
        setLastPriceMap((prev) => ({ ...prev, [key]: null }));
      }
    });
  }, [customerId, lines, lastPriceMap]);

  useEffect(() => {
    if (!customerId) return;
    const skuIds = Array.from(new Set(lines.map((line) => line.skuId).filter(Boolean)));
    const priceDate = orderDate || new Date().toISOString().slice(0, 10);
    skuIds.forEach(async (skuId) => {
      const qtyForSku = lines
        .filter((line) => line.skuId === skuId)
        .reduce((sum, line) => sum + Number(line.quantity || 0), 0);
      const qtyKey = Number.isFinite(qtyForSku) ? qtyForSku.toFixed(3) : "0.000";
      const key = `${customerId}:${skuId}:${priceDate}:${qtyKey}`;
      if (Object.prototype.hasOwnProperty.call(priceListMap, key)) return;
      try {
        const info = await apiGet<PriceListQuoteInfo>(
          `/api/sales-price-lists/resolve?customerId=${encodeURIComponent(customerId)}&skuId=${encodeURIComponent(
            skuId
          )}&date=${encodeURIComponent(priceDate)}&qty=${encodeURIComponent(String(qtyForSku || 0))}`
        );
        setPriceListMap((prev) => ({ ...prev, [key]: info }));
      } catch {
        setPriceListMap((prev) => ({ ...prev, [key]: null }));
      }
    });
  }, [customerId, orderDate, lines, priceListMap]);

  useEffect(() => {
    if (!customerId) return;
    setLines((prev) => {
      let changed = false;
      const priceDate = orderDate || new Date().toISOString().slice(0, 10);
      const next = prev.map((line) => {
        if (!line.skuId) return line;
        const qtyForSku = prev
          .filter((row) => row.skuId === line.skuId)
          .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
        const priceKey = `${customerId}:${line.skuId}:${priceDate}:${(Number.isFinite(qtyForSku) ? qtyForSku : 0).toFixed(3)}`;
        const priceListInfo = priceListMap[priceKey];
        const lastKey = `${customerId}:${line.skuId}`;
        const lastInfo = lastPriceMap[lastKey];
        const patch: Partial<DraftLineForm> = {};
        if ((!line.unitPrice || line.unitPrice === "") && priceListInfo?.unitPrice) {
          patch.unitPrice = String(priceListInfo.unitPrice);
        }
        if ((!line.discountPct || line.discountPct === "") && priceListInfo?.discountPct != null) {
          patch.discountPct = String(priceListInfo.discountPct ?? 0);
        }
        if (!line.taxPct || line.taxPct === "") {
          patch.taxPct = String(priceListInfo?.taxPct ?? lastInfo?.taxPct ?? 0);
        }
        if (Object.keys(patch).length === 0) return line;
        changed = true;
        return { ...line, ...patch };
      });
      return changed ? next : prev;
    });
  }, [customerId, orderDate, priceListMap, lastPriceMap]);

  function resetForm() {
    setNotes("");
    setOrderDate("");
    const selectedCustomer = customers.find((customer) => customer.id === customerId);
    setOrderCreditDays(String(selectedCustomer?.creditDays ?? 0));
    setOrderRemindBeforeDays(String(selectedCustomer?.remindBeforeDays ?? 3));
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
        taxPct: ""
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
        creditDays: Number(orderCreditDays || 0),
        remindBeforeDays: Number(orderRemindBeforeDays || 0),
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
    } else if (!detail) {
      scrollRestoreRef.current = 0;
    }
    try {
      const data = await apiGet<SalesOrderDetail>(`/api/sales-orders/${orderId}`);
      setDetail(data);
      const openDeliveries = data.lines
        .map((line) => {
          const orderOpenQty = Math.max(line.quantity - line.deliveredQty, 0);
          const producedUndeliveredQty = Math.max((line.producedQty ?? 0) - line.deliveredQty, 0);
          // Delivery UI should show what can be shipped now from this order's produced qty.
          const maxDispatchableQty = Math.min(orderOpenQty, producedUndeliveredQty);
          return {
            lineId: line.id,
            sku: line.sku,
            openQty: orderOpenQty,
            maxDispatchableQty,
            qty: "",
            deliveryDate: "",
            packagingCost: "",
            notes: ""
          };
        })
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
    if (!detail) return;
    if (focusSection === "procurement") {
      procurementRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setFocusSection(null);
    }
    if (focusSection === "deliveries") {
      deliveriesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const coveredDuplicateDeliveryInvoiceIds = useMemo(() => {
    if (!detail) return new Set<string>();
    const deliveredBySoLine = new Map(detail.lines.map((line) => [line.id, line.deliveredQty ?? 0]));
    const totalInvoicedBySoLine = new Map<string, number>();
    detail.invoices.forEach((invoice) => {
      invoice.lines.forEach((line) => {
        totalInvoicedBySoLine.set(line.soLineId, (totalInvoicedBySoLine.get(line.soLineId) ?? 0) + line.quantity);
      });
    });

    const covered = new Set<string>();
    detail.invoices.forEach((invoice) => {
      if (!invoice.deliveryId) return;
      const invoiceQtyBySoLine = new Map<string, number>();
      invoice.lines.forEach((line) => {
        invoiceQtyBySoLine.set(line.soLineId, (invoiceQtyBySoLine.get(line.soLineId) ?? 0) + line.quantity);
      });
      if (invoiceQtyBySoLine.size === 0) return;
      const fullyCoveredByOtherInvoices = Array.from(invoiceQtyBySoLine.entries()).every(([soLineId, invoiceQty]) => {
        const delivered = deliveredBySoLine.get(soLineId) ?? 0;
        const totalInvoiced = totalInvoicedBySoLine.get(soLineId) ?? 0;
        const otherInvoiced = Math.max(totalInvoiced - invoiceQty, 0);
        return otherInvoiced >= delivered;
      });
      if (fullyCoveredByOtherInvoices) {
        covered.add(invoice.id);
      }
    });
    return covered;
  }, [detail]);

  const unpaidInvoices = useMemo(() => {
    if (!detail) return [];
    return detail.invoices.filter((invoice) => {
      if (coveredDuplicateDeliveryInvoiceIds.has(invoice.id)) return false;
      const { balance } = computeInvoiceTotals(invoice);
      return balance > 0.005;
    });
  }, [detail, coveredDuplicateDeliveryInvoiceIds]);

  const paymentInvoiceOptions = useMemo(() => {
    return unpaidInvoices.map((invoice) => {
      const { balance } = computeInvoiceTotals(invoice);
      return {
        value: invoice.id,
        label: `${invoice.invoiceNumber ?? invoice.id} · Balance ${balance.toFixed(2)}`
      };
    });
  }, [unpaidInvoices]);

  useEffect(() => {
    if (!detail) return;
    if (!paymentInvoiceId || !unpaidInvoices.some((invoice) => invoice.id === paymentInvoiceId)) {
      setPaymentInvoiceId(unpaidInvoices[0]?.id ?? "");
    }
  }, [detail, unpaidInvoices, paymentInvoiceId]);

  const paymentRows = useMemo(() => {
    if (!detail) return [];
    return detail.invoices.flatMap((invoice) =>
      (invoice.payments ?? []).map((allocation) => ({
        id: allocation.id,
        invoiceNumber: invoice.invoiceNumber ?? "—",
        invoiceId: invoice.id,
        paymentDate: allocation.payment.paymentDate,
        amount: allocation.amount,
        method: allocation.payment.method,
        reference: allocation.payment.reference,
        notes: allocation.payment.notes
      }))
    );
  }, [detail]);

  const isOrderFullyPaid = useMemo(
    () => Boolean(detail && detail.invoices.length > 0 && unpaidInvoices.length === 0),
    [detail, unpaidInvoices]
  );

  const canPrintInvoice = useMemo(
    () =>
      deliveryLinesWithQty.length > 0 &&
      deliveryLinesWithQty.every((line) => Boolean(line.deliveryDate) && line.packagingCost.trim() !== ""),
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

  useEffect(() => {
    if (!detail) return;
    setPaymentBoxExpanded(!(detail.invoices.length > 0 && unpaidInvoices.length === 0));
  }, [detail, unpaidInvoices.length]);

  async function updateStatus(order: SalesOrder, action: "confirm" | "production" | "dispatch") {
    if (action === "dispatch") {
      const totalProduced = order.lines.reduce((sum, line) => sum + (line.producedQty ?? 0), 0);
      if (totalProduced <= 0) {
        push("error", "Cannot dispatch without any produced quantity. Close a production log first.");
        return;
      }
    }
    try {
      await apiSend(`/api/sales-orders/${order.id}/${action}`, "POST");
      push("success", "Order status updated");
      if (action === "production") {
        router.push(`/production?orderId=${order.id}`);
        return;
      }
      loadData();
      if (action === "dispatch") {
        setFocusSection("deliveries");
        openDetail(order.id);
        return;
      }
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

  async function skipProduction(orderId: string) {
    try {
      await apiSend(`/api/sales-orders/${orderId}/skip-production`, "POST");
      push("success", "Order dispatched from finished stock");
      loadData();
      setFocusSection("deliveries");
      openDetail(orderId);
    } catch (error: any) {
      push("error", error.message ?? "Failed to dispatch from finished stock");
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
        deliveryDate: new Date(line.deliveryDate).toISOString(),
        notes: line.notes || undefined
      }));

    if (payloadLines.length === 0) {
      push("error", "Enter quantities to deliver");
      return;
    }

    const invalid = deliveryLines.some((line) => Number(line.qty) > line.maxDispatchableQty);
    if (invalid) {
      push("error", "Delivery quantity cannot exceed max dispatchable quantity");
      return;
    }

    const missingDetails = deliveryLinesWithQty.some(
      (line) => line.packagingCost.trim() === "" || !line.deliveryDate
    );
    if (missingDetails) {
      push("error", "Enter delivery date and delivery cost before posting the delivery");
      return;
    }

    try {
      const updated = await apiSend<SalesOrderDetail>(`/api/sales-orders/${detail.id}/deliveries`, "POST", {
        lines: payloadLines
      });
      push("success", "Delivery recorded");

      // Only create per-delivery invoice when user explicitly chose "Post Delivery + Print Invoice"
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

  async function createConsolidatedInvoice() {
    if (!detail) return;

    // Calculate un-invoiced qty per order line
    const invoicedQtyByLine = new Map<string, number>();
    for (const inv of detail.invoices) {
      for (const line of inv.lines) {
        invoicedQtyByLine.set(line.soLineId, (invoicedQtyByLine.get(line.soLineId) ?? 0) + line.quantity);
      }
    }

    const lines = detail.lines
      .map((line) => {
        const delivered = line.deliveredQty ?? 0;
        const invoiced = invoicedQtyByLine.get(line.id) ?? 0;
        const openQty = Math.max(delivered - invoiced, 0);
        return { lineId: line.id, quantity: openQty, unitPrice: line.unitPrice, openQty };
      })
      .filter((l) => l.openQty > 0);

    if (lines.length === 0) {
      push("error", "All delivered quantities are already invoiced");
      return;
    }

    try {
      const invoice = await apiSend<Invoice>(`/api/sales-orders/${detail.id}/invoices`, "POST", {
        lines: lines.map(({ lineId, quantity, unitPrice }) => ({ lineId, quantity, unitPrice }))
      });
      push("success", `Consolidated invoice ${(invoice as any).invoiceNumber ?? ""} created`);
      downloadInvoicePdf(invoice.id, includePackagingInInvoice);
      openDetail(detail.id);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to create consolidated invoice");
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

  function downloadPackingSlip(orderId: string, deliveryId: string) {
    window.open(`/api/sales-orders/${orderId}/deliveries/${deliveryId}/packing-slip`, "_blank");
  }


  async function submitPayment() {
    if (!detail) return;
    if (!paymentInvoiceId) {
      push("error", "Select an invoice to record payment");
      return;
    }
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      push("error", "Enter a valid payment amount");
      return;
    }

    setPaymentSubmitting(true);
    try {
      await apiSend("/api/sales-payments", "POST", {
        invoiceId: paymentInvoiceId,
        amount,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        method: paymentMethod || undefined,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined
      });
      push("success", "Payment recorded");
      setPaymentAmount("");
      setPaymentMethod("");
      setPaymentReference("");
      setPaymentNotes("");
      openDetail(detail.id);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to record payment");
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function submitAdditionalCharge() {
    if (!detail) return;
    const amount = Number(chargeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      push("error", "Enter a valid additional charge amount");
      return;
    }

    setChargeSubmitting(true);
    try {
      await apiSend<Invoice>(`/api/sales-orders/${detail.id}/charges`, "POST", {
        amount,
        invoiceDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        notes: chargeNotes || undefined
      });
      push("success", "Additional charge bill created");
      setChargeAmount("");
      setChargeNotes("");
      openDetail(detail.id);
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to add additional charge");
    } finally {
      setChargeSubmitting(false);
    }
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange("all"));

  /* ---- date-filtered orders ---- */
  const dateFilteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!o.orderDate) return true;
      const d = new Date(o.orderDate);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [orders, dateRange]);

  const orderSummary = useMemo(() => {
    const src = dateFilteredOrders;
    const totalOrders = src.length;
    const totalItems = src.reduce((sum, o) => sum + o.lines.length, 0);
    const scrapOrders = src.filter((o) => o.lines.some((l) => l.scrapQty > 0)).length;
    const customerOrders = totalOrders - scrapOrders;
    const completedOrders = src.filter((o) => o.status === "DELIVERED" || o.status === "INVOICED").length;
    const fulfilledOrders = completedOrders;
    const productionOrders = src.filter((o) => o.status === "PRODUCTION").length;
    const notStartedOrders = src.filter((o) => o.status === "QUOTE" || o.status === "CONFIRMED").length;
    return { totalOrders, totalItems, customerOrders, scrapOrders, fulfilledOrders, completedOrders, productionOrders, notStartedOrders };
  }, [dateFilteredOrders]);

  const orderAlerts = useMemo(() => {
    const now = Date.now();
    const MS_PER_DAY = 86400000;
    const alerts: { id: string; soNumber: string; customer: string; message: string; severity: "red" | "orange" | "yellow" }[] = [];

    for (const o of dateFilteredOrders) {
      const ageMs = now - new Date(o.orderDate).getTime();
      const ageDays = Math.floor(ageMs / MS_PER_DAY);

      // Stalled: QUOTE/CONFIRMED for 14+ days
      if ((o.status === "QUOTE" || o.status === "CONFIRMED") && ageDays >= 14) {
        alerts.push({
          id: o.id,
          soNumber: o.soNumber ?? o.id,
          customer: o.customer.name,
          message: `Stalled at ${o.status} for ${ageDays} days — production not started`,
          severity: ageDays >= 21 ? "red" : "orange"
        });
      }

      // Long in production: PRODUCTION for 10+ days
      if (o.status === "PRODUCTION" && ageDays >= 10) {
        alerts.push({
          id: o.id,
          soNumber: o.soNumber ?? o.id,
          customer: o.customer.name,
          message: `In production for ${ageDays} days — delivery may be delayed`,
          severity: ageDays >= 20 ? "red" : "orange"
        });
      }

      // Payment overdue: has outstanding balance
      if (o.payment && o.payment.outstanding > 0 && (o.status === "DELIVERED" || o.status === "INVOICED")) {
        const daysOverdue = o.creditDays ? Math.max(0, ageDays - o.creditDays) : 0;
        if (daysOverdue > 0) {
          alerts.push({
            id: o.id,
            soNumber: o.soNumber ?? o.id,
            customer: o.customer.name,
            message: `Payment overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} — ₹${o.payment.outstanding.toLocaleString("en-IN")} outstanding`,
            severity: daysOverdue > 14 ? "red" : "yellow"
          });
        }
      }
    }

    return alerts.sort((a, b) => (a.severity === "red" ? -1 : b.severity === "red" ? 1 : 0));
  }, [dateFilteredOrders]);

  /* ---- status counts ---- */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: dateFilteredOrders.length };
    dateFilteredOrders.forEach((o) => {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
    });
    return counts;
  }, [dateFilteredOrders]);

  /* ---- status + search filter ---- */
  const filteredOrders = useMemo(() => {
    let filtered = dateFilteredOrders;
    if (activeFilter !== "all") {
      filtered = filtered.filter((o) => o.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((o) =>
        (o.soNumber ?? "").toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [dateFilteredOrders, activeFilter, searchQuery]);

  function buildOrderRows(source: SalesOrder[]) {
    return source.map((order) => {
      const badge = statusBadge[order.status] ?? { label: order.status, variant: "neutral" as const };
      const paymentStatus = order.payment?.status ?? "NOT_BILLED";
      const isFulfilled = order.status === "DELIVERED" || order.status === "INVOICED";
      const total = order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0);
      const itemCount = order.lines.length;
      const billed = order.payment?.totalBilled ?? 0;
      const paid = order.payment?.totalPaid ?? 0;
      const outstanding = order.payment?.outstanding ?? 0;
      const billingPct = billed > 0 ? Math.max(0, Math.min(100, Math.round((paid / billed) * 100))) : 0;
      const nextDueDate = order.payment?.nextDueDate ? new Date(order.payment.nextDueDate) : null;
      const hasNextDueDate = Boolean(nextDueDate && !Number.isNaN(nextDueDate.getTime()));
      const overdueInvoiceCount = order.payment?.overdueInvoiceCount ?? 0;
      const openInvoiceCount = order.payment?.openInvoiceCount ?? 0;
      const totalOrderedQty = order.lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
      const totalProducedQty = order.lines.reduce((s, l) => s + (l.producedQty ?? 0), 0);
      const totalDeliveredQty = order.lines.reduce((s, l) => s + (l.deliveredQty ?? 0), 0);
      return {
        so: (
          <button
            onClick={() => { setFocusSection(null); openDetail(order.id); }}
            className="text-accent font-semibold hover:underline text-left"
          >
            {order.soNumber ?? '—'}
          </button>
        ),
        date: formatDate(order.orderDate),
        customer: order.customer.name,
        value: formatCurrency(total, order.currency),
        status: <Badge {...badge} />,
        payment: (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${paymentStatus === "PAID" ? "bg-green-500" : paymentStatus === "PARTIALLY_PAID" ? "bg-yellow-500" : "bg-orange-400"}`} />
            {paymentStatus === "PAID" ? "Paid" : paymentStatus === "PARTIALLY_PAID" ? "Partial" : paymentStatus === "UNPAID" ? "Unpaid" : "Not Billed"}
          </span>
        ),
        due: billed <= 0 ? (
          <span className="text-xs text-text-muted">—</span>
        ) : outstanding <= 0 ? (
          <div className="ml-auto text-right" title="No collection due. All billed invoices are cleared.">
            <div className="text-xs font-medium text-green-700">Cleared</div>
            <div className="text-[10px] text-text-muted">No due</div>
          </div>
        ) : hasNextDueDate && nextDueDate ? (
          <div
            className="ml-auto text-right"
            title={`${overdueInvoiceCount > 0 ? "Overdue" : "Next due"}: ${formatDate(nextDueDate)}${openInvoiceCount > 1 ? ` • ${openInvoiceCount} open invoices` : ""}`}
          >
            <div className={`text-xs font-semibold ${overdueInvoiceCount > 0 ? "text-red-700" : "text-amber-700"}`}>
              {formatDate(nextDueDate)}
            </div>
            <div className={`text-[10px] ${overdueInvoiceCount > 0 ? "text-red-600" : "text-text-muted"}`}>
              {overdueInvoiceCount > 0
                ? `Overdue${overdueInvoiceCount > 1 ? ` (${overdueInvoiceCount})` : ""}`
                : openInvoiceCount > 1
                  ? `${openInvoiceCount} open inv.`
                  : "Next due"}
            </div>
          </div>
        ) : (
          <div className="ml-auto text-right" title="Open invoice(s) exist but due date is missing">
            <div className="text-xs font-medium text-amber-700">No due date</div>
            <div className="text-[10px] text-text-muted">
              {openInvoiceCount > 0 ? `${openInvoiceCount} open inv.` : "Open invoice"}
            </div>
          </div>
        ),
        paid: billed <= 0 ? (
          <div className="ml-auto text-right" title="No invoices billed yet">
            <div className="text-sm font-medium text-text">—</div>
            <div className="text-[10px] text-text-muted">Not billed</div>
          </div>
        ) : (
          <div
            className="ml-auto min-w-[132px] max-w-[164px] text-right"
            title={`Paid: ${formatCurrency(paid, order.currency)} | Billed: ${formatCurrency(billed, order.currency)}${outstanding > 0 ? ` | Balance: ${formatCurrency(outstanding, order.currency)}` : " | Balance: 0"}`}
          >
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-xs font-semibold tabular-nums text-text">
                {formatCurrencyCompact(paid, order.currency)}
              </span>
              <span className="text-[10px] text-text-muted">/</span>
              <span className="text-xs font-medium tabular-nums text-text-muted">
                {formatCurrencyCompact(billed, order.currency)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-end gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-1.5 rounded-full transition-all ${outstanding > 0 ? "bg-amber-400" : "bg-green-500"}`}
                  style={{ width: `${billingPct}%` }}
                />
              </div>
              <span className={`text-[10px] font-medium ${outstanding > 0 ? "text-amber-700" : "text-green-700"}`}>
                {outstanding > 0 ? `Bal ${formatCurrencyCompact(outstanding, order.currency)}` : "Clear"}
              </span>
            </div>
          </div>
        ),
        items: `${itemCount} item${itemCount !== 1 ? "s" : ""}`,
        fulfillment: (() => {
          if (order.status === "PRODUCTION" || (totalProducedQty > 0 && !isFulfilled && order.status !== "DISPATCH")) {
            const pct = totalOrderedQty > 0 ? Math.round((totalProducedQty / totalOrderedQty) * 100) : 0;
            return (
              <div className="min-w-[140px]">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-700">
                    {totalProducedQty} / {totalOrderedQty}
                  </span>
                  <span className="text-xs text-text-muted">{pct}% prod.</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(pct, 0))}%` }}
                  />
                </div>
                {totalDeliveredQty > 0 ? (
                  <div className="mt-1 text-[10px] text-text-muted">
                    Delivered: {totalDeliveredQty.toLocaleString()}
                  </div>
                ) : null}
              </div>
            );
          }
          // For DISPATCH orders show delivery progress — how much of each SKU has shipped
          if (order.status === "DISPATCH") {
            const deliveryPct = totalOrderedQty > 0 ? Math.round((totalDeliveredQty / totalOrderedQty) * 100) : 0;
            const productionPct = totalOrderedQty > 0 ? Math.round((totalProducedQty / totalOrderedQty) * 100) : 0;
            return (
              <div className="min-w-[160px] space-y-2">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-blue-600">Production</span>
                    <span className="text-[10px] text-text-muted">{productionPct}%</span>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-blue-700 font-medium">
                      {totalProducedQty} / {totalOrderedQty}
                    </span>
                    {productionPct >= 100 ? (
                      <span className="text-[10px] font-medium text-green-600">Completed</span>
                    ) : null}
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-200">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(100, Math.max(productionPct, 0))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600">Delivery</span>
                    <span className="text-[10px] text-text-muted">{deliveryPct}%</span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-amber-700 font-medium">
                      {totalDeliveredQty} / {totalOrderedQty}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {deliveryPct === 0 ? "Not started" : deliveryPct < 100 ? "Partial" : "Complete"}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-200">
                    <div
                      className="h-1.5 rounded-full bg-amber-400 transition-all"
                      style={{ width: `${Math.min(100, Math.max(deliveryPct, 0))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          }
          return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isFulfilled
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
              }`}>
              <span className={`w-2 h-2 rounded-full ${isFulfilled ? "bg-green-500" : "bg-red-500"}`} />
              {isFulfilled ? "Fulfilled" : "Unfulfilled"}
            </span>
          );
        })(),
        actions: (
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" onClick={() => { setFocusSection(null); openDetail(order.id); }}>
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
              <>
                <Button variant="ghost" onClick={() => updateStatus(order, "production")}>
                  Start Production
                </Button>
                {order.canUseFinishedStock && (
                  <Button
                    variant="ghost"
                    className="text-emerald-600 hover:text-emerald-700"
                    onClick={() => skipProduction(order.id)}
                    title="Fulfill this order directly from finished goods stock, skipping production"
                  >
                    Use Finished Stock
                  </Button>
                )}
              </>
            ) : null}
            {order.status === "PRODUCTION" ? (
              <Button
                variant="ghost"
                onClick={() => updateStatus(order, "dispatch")}
                disabled={order.lines.every((line) => (line.producedQty ?? 0) <= 0)}
              >
                Dispatch
              </Button>
            ) : null}
            {order.status === "DISPATCH" ? (
              <Button
                variant="ghost"
                onClick={() => { setFocusSection("deliveries"); openDetail(order.id); }}
              >
                Mark Delivered
              </Button>
            ) : null}
          </div>
        )
      };
    });
  }

  const orderTableColumns: DataColumn[] = [
    { key: "so", label: "Order" },
    { key: "date", label: "Date" },
    { key: "customer", label: "Customer" },
    { key: "value", label: "Value", align: "right" },
    { key: "status", label: "Status" },
    { key: "payment", label: "Payment" },
    { key: "due", label: "Due", align: "right" },
    { key: "paid", label: "Billing", align: "right" },
    { key: "items", label: "Items" },
    { key: "fulfillment", label: "Fulfilment" },
    { key: "actions", label: "" }
  ];

  const statusFilterTabs = [
    { key: "all", label: "All" },
    { key: "QUOTE", label: "Quote" },
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "PRODUCTION", label: "Production" },
    { key: "DISPATCH", label: "Dispatch" },
    { key: "DELIVERED", label: "Delivered" },
    { key: "INVOICED", label: "Invoiced" }
  ];

  return (
    <div className="flex flex-col gap-6">
      <ToastViewport toasts={toasts} onDismiss={remove} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Techno Synergians</p>
          <h1 className="mt-2 text-3xl font-semibold">Orders</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button onClick={() => setCreateFormOpen(!createFormOpen)}>
            Create order
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <DateFilter
        value={dateRange}
        onChange={(range) => setDateRange(range)}
        defaultPreset="all"
      />

      {/* Collapsible Create Form */}
      {createFormOpen && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Create Sales Order</CardTitle>
            <button onClick={() => setCreateFormOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <ChevronUp className="w-5 h-5" />
            </button>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleCreate}>
              <Select
                label="Customer"
                value={customerId}
                onChange={(event) => {
                  const nextCustomerId = event.target.value;
                  setCustomerId(nextCustomerId);
                  const selected = customers.find((customer) => customer.id === nextCustomerId);
                  setOrderCreditDays(String(selected?.creditDays ?? 0));
                  setOrderRemindBeforeDays(String(selected?.remindBeforeDays ?? 3));
                }}
                options={customerOptions}
                required
              />
              <Input
                label="Order Date"
                type="date"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Credit Days"
                  type="number"
                  min="0"
                  value={orderCreditDays}
                  onChange={(event) => setOrderCreditDays(event.target.value)}
                />
                <Input
                  label="Remind Before (days)"
                  type="number"
                  min="0"
                  value={orderRemindBeforeDays}
                  onChange={(event) => setOrderRemindBeforeDays(event.target.value)}
                />
              </div>
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
                  lines.map((line, index) => {
                    const lastKey = customerId && line.skuId ? `${customerId}:${line.skuId}` : "";
                    const priceDate = orderDate || new Date().toISOString().slice(0, 10);
                    const qtyForSku = lines
                      .filter((row) => row.skuId === line.skuId)
                      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
                    const priceListKey =
                      customerId && line.skuId
                        ? `${customerId}:${line.skuId}:${priceDate}:${(Number.isFinite(qtyForSku) ? qtyForSku : 0).toFixed(3)}`
                        : "";
                    const priceListQuote = priceListKey ? priceListMap[priceListKey] : null;
                    const lastPrice = lastKey ? lastPriceMap[lastKey] : null;
                    const priceListHint = line.skuId
                      ? priceListQuote
                        ? `Price list: ${priceListQuote.priceList?.name ?? "Applied"} · ${formatCurrency(priceListQuote.unitPrice)}${priceListQuote.effectiveFrom ? ` · from ${formatDate(priceListQuote.effectiveFrom)}` : ""}${priceListQuote.effectiveTo ? ` to ${formatDate(priceListQuote.effectiveTo)}` : ""}`
                        : "No active price list price for selected date."
                      : undefined;
                    const lastPriceHint = line.skuId
                      ? lastPrice
                        ? `Last price: ${formatCurrency(lastPrice.unitPrice)}${lastPrice.soNumber ? ` \u00b7 ${lastPrice.soNumber}` : ""}${lastPrice.date ? ` \u00b7 ${formatDate(lastPrice.date)}` : ""
                        }`
                        : "No previous price for this customer."
                      : undefined;

                    return (
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
                            hint={priceListQuote ? priceListHint : lastPriceHint}
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
                    );
                  })
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
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Orders</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{orderSummary.totalOrders}</h3>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 text-purple-500">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-green-50 px-2 py-2">
              <p className="text-[10px] font-medium text-green-500 uppercase tracking-wide">Completed</p>
              <p className="text-lg font-bold text-green-700">{orderSummary.completedOrders}</p>
            </div>
            <div className="rounded-lg bg-blue-50 px-2 py-2">
              <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">In Prod.</p>
              <p className="text-lg font-bold text-blue-700">{orderSummary.productionOrders}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-2 py-2">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Pending</p>
              <p className="text-lg font-bold text-gray-700">{orderSummary.notStartedOrders}</p>
            </div>
          </div>
        </div>
        {/* Alerts Card */}
        <button
          onClick={() => setAlertsModalOpen(true)}
          className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-orange-200 transition-all group"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Alerts</p>
              <h3 className={`text-2xl font-bold mt-1 ${orderAlerts.length > 0 ? "text-orange-500" : "text-gray-900"}`}>
                {orderAlerts.length}
              </h3>
            </div>
            <div className={`relative p-2 rounded-lg ${orderAlerts.length > 0 ? "bg-orange-50" : "bg-gray-50"}`}>
              <AlertTriangle className={`w-5 h-5 ${orderAlerts.length > 0 ? "text-orange-500" : "text-gray-400"}`} />
              {orderAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {orderAlerts.filter(a => a.severity === "red").length || "!"}
                </span>
              )}
            </div>
          </div>
          {orderAlerts.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {orderAlerts.filter(a => a.severity === "red").length} critical
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                {orderAlerts.filter(a => a.severity === "orange").length} warnings
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
              All clear
            </span>
          )}
        </button>
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Order Split</p>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 text-green-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Customer</p>
              <p className="text-xl font-bold text-gray-900">{orderSummary.customerOrders}</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-emerald-500 bg-emerald-50 mt-1">
                <ArrowUp className="w-3 h-3" />
                {orderSummary.customerOrders} orders
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Scrap Material</p>
              <p className="text-xl font-bold text-gray-900">{orderSummary.scrapOrders}</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 bg-gray-50 mt-1">
                {orderSummary.scrapOrders > 0 ? `${orderSummary.scrapOrders} orders` : "None"}
              </span>
            </div>
          </div>
        </div>
        <MetricCard
          label="Fulfilled orders"
          value={`${orderSummary.fulfilledOrders}`}
          trend={orderSummary.fulfilledOrders > 0 ? `${((orderSummary.fulfilledOrders / Math.max(orderSummary.totalOrders, 1)) * 100).toFixed(0)}% fulfilled` : "0%"}
          trendDirection="up"
          icon={CheckCircle2}
          iconColor="text-green-500"
        />
      </div>

      {/* Alerts Modal */}
      {alertsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAlertsModalOpen(false); }}
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="font-semibold text-gray-900">Order Alerts</span>
                <span className="text-xs font-medium text-white bg-orange-400 rounded-full px-2 py-0.5">{orderAlerts.length}</span>
              </div>
              <button onClick={() => setAlertsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {orderAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <CheckCircle2 className="w-8 h-8 mb-2 text-green-400" />
                <p className="text-sm">No alerts — all orders look good!</p>
              </div>
            ) : (
              <div className="overflow-y-auto divide-y divide-gray-100">
                {orderAlerts.map((alert) => (
                  <button
                    key={`${alert.id}-${alert.message}`}
                    onClick={() => { setAlertsModalOpen(false); openDetail(alert.id); }}
                    className="w-full flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className={`mt-1 flex-shrink-0 w-2.5 h-2.5 rounded-full ${alert.severity === "red" ? "bg-red-500" : alert.severity === "orange" ? "bg-orange-400" : "bg-yellow-400"
                      }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{alert.soNumber}</span>
                        <span className="text-xs text-gray-400">{alert.customer}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.message}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1 -rotate-90" />
                  </button>
                ))}
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
              Click any alert to open the order detail
            </div>
          </div>
        </div>
      )}

      <Card>
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {statusFilterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeFilter === tab.key
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {tab.label} ({statusCounts[tab.key] ?? 0})
                </button>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 ml-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-48"
                />
              </div>
              <button className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <CardBody className="pt-0">
          <div className="max-h-[600px] overflow-y-auto">
            <DataTable
              columns={orderTableColumns}
              rows={buildOrderRows(
                [...filteredOrders]
                  .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
              )}
              emptyLabel={loading ? "Loading orders..." : "No orders found."}
            />
          </div>
          <p className="px-2 py-2 text-xs text-text-muted text-center border-t border-gray-100">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
          </p>
        </CardBody>
      </Card>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `Sales Order ${detail.soNumber ?? detail.id}` : "Sales Order"}
        className="max-w-5xl"
        scrollRef={detailScrollRef}
        autoScrollTop={false}
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
                {(detail.status === "CONFIRMED") && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Fulfil this order</p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => updateStatus(detail, "production")}>
                        Start Production
                      </Button>
                      {detail.availability.lines.some(
                        (line) => line.productionRequired > 0 && line.finishedFromStock > 0
                      ) ? (
                        <Button
                          variant="ghost"
                          className="border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => skipProduction(detail.id)}
                        >
                          Use Finished Stock
                        </Button>
                      ) : null}
                    </div>
                    {detail.availability.lines.some(
                      (line) => line.productionRequired > 0 && line.finishedFromStock > 0
                    ) ? (
                      <p className="text-xs text-text-muted">
                        <strong>Use Finished Stock</strong> skips production and deducts the available qty directly from finished goods inventory. Partial deliveries are supported.
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted">
                        Finished goods stock is not available for the pending SKU(s), so production is required.
                      </p>
                    )}
                  </div>
                )}
                {detail.status === "DISPATCH" ? (
                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        const allDelivered = detail.lines.every(
                          (line) => (line.deliveredQty ?? 0) >= line.quantity
                        );
                        const hasDeliveries = detail.deliveries.length > 0;
                        if (!allDelivered || !hasDeliveries || deliveryLines.length > 0) {
                          setFocusSection("deliveries");
                          return;
                        }
                        markDelivered(detail.id);
                      }}
                    >
                      Mark Delivered
                    </Button>
                    {detail.lines.every((line) => (line.deliveredQty ?? 0) >= line.quantity) ? null : (
                      <p className="mt-2 text-xs text-text-muted">
                        Record deliveries and delivery cost below before marking delivered.
                      </p>
                    )}
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

            <div ref={deliveriesRef}>
              <Card>
                <CardHeader>
                  <CardTitle>Deliveries</CardTitle>
                </CardHeader>
                <CardBody>
                  {(() => {
                    const invoicedQtyByLine = new Map<string, number>();
                    for (const invoice of detail.invoices) {
                      for (const line of invoice.lines) {
                        invoicedQtyByLine.set(line.soLineId, (invoicedQtyByLine.get(line.soLineId) ?? 0) + line.quantity);
                      }
                    }
                    return (
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
                      ...(function () {
                        const lineDelivered = delivery.line.deliveredQty ?? 0;
                        const lineInvoiced = invoicedQtyByLine.get(delivery.soLineId) ?? 0;
                        const lineOpenToInvoice = Math.max(lineDelivered - lineInvoiced, 0);
                        const hasDirectInvoice = detail.invoices.some((invoice) => invoice.deliveryId === delivery.id);
                        const canCreateDeliveryInvoice = !hasDirectInvoice && lineOpenToInvoice >= delivery.quantity;
                        const invoiceStateLabel = hasDirectInvoice
                          ? "Invoiced"
                          : lineOpenToInvoice <= 0
                            ? "Covered by other invoice"
                            : lineOpenToInvoice < delivery.quantity
                              ? "Partly covered"
                              : null;
                        return {
                          __hasDirectInvoice: hasDirectInvoice,
                          __canCreateDeliveryInvoice: canCreateDeliveryInvoice,
                          __invoiceStateLabel: invoiceStateLabel
                        };
                      })(),
                      date: formatDate(delivery.deliveryDate),
                      sku: `${delivery.line.sku.code} · ${delivery.line.sku.name}`,
                      qty: `${delivery.quantity} ${delivery.line.sku.unit}`,
                      packaging: delivery.packagingCost ? delivery.packagingCost.toFixed(2) : "—",
                      notes: delivery.notes ?? "—",
                      actions: (
                        <div className="flex items-center gap-1">
                          {(function () {
                            const lineDelivered = delivery.line.deliveredQty ?? 0;
                            const lineInvoiced = invoicedQtyByLine.get(delivery.soLineId) ?? 0;
                            const lineOpenToInvoice = Math.max(lineDelivered - lineInvoiced, 0);
                            const hasDirectInvoice = detail.invoices.some((invoice) => invoice.deliveryId === delivery.id);
                            const canCreateDeliveryInvoice = !hasDirectInvoice && lineOpenToInvoice >= delivery.quantity;
                            if (!canCreateDeliveryInvoice) {
                              return (
                                <span className="text-xs text-text-muted">
                                  {hasDirectInvoice
                                    ? "Invoiced"
                                    : lineOpenToInvoice <= 0
                                      ? "Covered by other invoice"
                                      : "Partly covered"}
                                </span>
                              );
                            }
                            return (
                              <Button variant="ghost" onClick={() => createInvoiceForDelivery(delivery.id)}>
                                Create Invoice
                              </Button>
                            );
                          })()}
                          <Button variant="ghost" onClick={() => downloadPackingSlip(detail.id, delivery.id)}>
                            Packing Slip
                          </Button>
                        </div>
                      )
                    }))}
                    emptyLabel="No deliveries recorded yet."
                  />
                    );
                  })()}
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
                              <div className="mt-1 space-y-0.5 text-xs">
                                <p className="text-text-muted">
                                  Order open: {line.openQty} {line.sku.unit}
                                </p>
                                <p className={line.maxDispatchableQty > 0 ? "text-blue-700 font-medium" : "text-amber-700 font-medium"}>
                                  Max dispatchable now: {line.maxDispatchableQty} {line.sku.unit}
                                </p>
                              </div>
                            </div>
                            <Input
                              label="Qty"
                              type="number"
                              min={0}
                              max={line.maxDispatchableQty}
                              value={line.qty}
                              error={
                                line.qty.trim() !== "" && Number(line.qty) > line.maxDispatchableQty
                                  ? `Max ${line.maxDispatchableQty} ${line.sku.unit}`
                                  : undefined
                              }
                              hint={
                                line.maxDispatchableQty <= 0
                                  ? "No dispatchable quantity yet. Produce more or move finished stock before delivery."
                                  : `You can send up to ${line.maxDispatchableQty} ${line.sku.unit} in this delivery entry.`
                              }
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
                          Add delivery date and delivery cost to post delivery.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => submitDeliveries()} disabled={!canPrintInvoice}>
                          Post Delivery
                        </Button>
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
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Invoices</CardTitle>
                  {(() => {
                    // Show consolidated invoice button if there are un-invoiced delivered quantities
                    const invoicedQtyByLine = new Map<string, number>();
                    for (const inv of detail.invoices) {
                      for (const line of inv.lines) {
                        invoicedQtyByLine.set(line.soLineId, (invoicedQtyByLine.get(line.soLineId) ?? 0) + line.quantity);
                      }
                    }
                    const hasUninvoiced = detail.lines.some((line) => {
                      const delivered = line.deliveredQty ?? 0;
                      const invoiced = invoicedQtyByLine.get(line.id) ?? 0;
                      return delivered > invoiced;
                    });
                    return hasUninvoiced ? (
                      <Button variant="secondary" onClick={createConsolidatedInvoice}>
                        Create Consolidated Invoice
                      </Button>
                    ) : null;
                  })()}
                </div>
              </CardHeader>
              <CardBody>
                {detail.invoices.length === 0 ? (
                  <p className="text-sm text-text-muted py-3">No invoices yet.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs text-text-muted">
                      {(() => {
                        const normalizedStatuses = detail.invoices.map((inv) => ({
                          id: inv.id,
                          status: deriveInvoicePaymentStatus(inv)
                        }));
                        const paidCount = normalizedStatuses.filter((inv) => inv.status === "PAID").length;
                        const partialPaidCount = normalizedStatuses.filter((inv) => inv.status === "PARTIALLY_PAID").length;
                        const unpaidCount = detail.invoices.filter(
                          (inv) =>
                            !coveredDuplicateDeliveryInvoiceIds.has(inv.id) &&
                            (() => {
                              const status = deriveInvoicePaymentStatus(inv);
                              return status === "UNPAID" || status === "ISSUED";
                            })()
                        ).length;
                        const duplicateCoveredCount = detail.invoices.filter((inv) =>
                          coveredDuplicateDeliveryInvoiceIds.has(inv.id)
                        ).length;
                        return (
                          <span>
                            {detail.invoices.length} invoice{detail.invoices.length !== 1 ? "s" : ""} · {paidCount} paid
                            {partialPaidCount ? ` · ${partialPaidCount} partially paid` : ""}
                            {unpaidCount ? ` · ${unpaidCount} unpaid` : ""}
                            {duplicateCoveredCount ? ` · ${duplicateCoveredCount} duplicate-covered` : ""}
                          </span>
                        );
                      })()}
                    </div>
                    {coveredDuplicateDeliveryInvoiceIds.size > 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {coveredDuplicateDeliveryInvoiceIds.size} delivery invoice(s) are already covered by other invoice(s) for the same delivered quantity. They are excluded from payment collection. Void them to clean up billing.
                      </div>
                    ) : null}
                    {detail.invoices.map((invoice, idx) => {
                      const { total, balance } = computeInvoiceTotals(invoice);
                      const normalizedPaymentStatus = deriveInvoicePaymentStatus(invoice);
                      const isCoveredDuplicateDeliveryInvoice = coveredDuplicateDeliveryInvoiceIds.has(invoice.id);
                      const isPartial = detail.invoices.length > 1 && idx < detail.invoices.length - 1;
                      return (
                        <div
                          key={invoice.id}
                          className="rounded-2xl border border-border/60 bg-bg-subtle/60 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-sm font-semibold text-text">
                                  {invoice.invoiceNumber ?? "—"}
                                </p>
                                <p className="text-xs text-text-muted mt-0.5">
                                  {formatDate(invoice.invoiceDate)}
                                  {invoice.dueDate ? ` · Due ${formatDate(invoice.dueDate)}` : ""}
                                </p>
                              </div>
                              {isPartial && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  Delivery Split
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                isCoveredDuplicateDeliveryInvoice
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : normalizedPaymentStatus === "PAID"
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : normalizedPaymentStatus === "PARTIALLY_PAID"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                              }`}>
                                {isCoveredDuplicateDeliveryInvoice
                                  ? "Payment: Covered (Duplicate Invoice)"
                                  : `Payment: ${formatInvoicePaymentStatus(normalizedPaymentStatus)}`}
                              </span>
                              <Button variant="ghost" onClick={() => downloadInvoicePdf(invoice.id)}>
                                PDF
                              </Button>
                            </div>
                          </div>

                          {/* Items dispatched in this invoice */}
                          <div className="mt-3 space-y-1">
                            {invoice.lines.map((line) => (
                              <div key={line.id} className="flex items-center justify-between text-sm">
                                <span className="text-text">
                                  {line.sku ? `${line.sku.code} · ${line.sku.name}` : line.skuId}
                                </span>
                                <span className="text-text-muted text-xs">
                                  {line.quantity}{line.sku ? ` ${line.sku.unit}` : ""}
                                  {" · "}
                                  {formatCurrency(line.quantity * line.unitPrice)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Totals row */}
                          <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                            <span>Total: <strong className="text-text">{formatCurrency(total)}</strong></span>
                            {isCoveredDuplicateDeliveryInvoice ? (
                              <span className="text-amber-700">Covered by another invoice (not collectible)</span>
                            ) : balance > 0 ? (
                              <span className="text-yellow-700">Balance due: {formatCurrency(balance)}</span>
                            ) : null}
                            {invoice.delivery?.packagingCost ? (
                              <span>Packaging: {formatCurrency(invoice.delivery.packagingCost)}</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
              </CardHeader>
              <CardBody>
                <DataTable
                  columns={[
                    { key: "date", label: "Date" },
                    { key: "invoice", label: "Invoice" },
                    { key: "amount", label: "Amount", align: "right" },
                    { key: "method", label: "Method" },
                    { key: "reference", label: "Reference" },
                    { key: "notes", label: "Notes" }
                  ]}
                  rows={paymentRows.map((row) => ({
                    date: formatDate(row.paymentDate),
                    invoice: row.invoiceNumber,
                    amount: row.amount.toFixed(2),
                    method: row.method ?? "—",
                    reference: row.reference ?? "—",
                    notes: row.notes ?? "—"
                  }))}
                  emptyLabel="No payments recorded yet."
                />

                <div className="mt-6 space-y-4">
                  {isOrderFullyPaid && !paymentBoxExpanded ? (
                    <button
                      type="button"
                      className="text-sm text-primary underline underline-offset-2"
                      onClick={() => setPaymentBoxExpanded(true)}
                    >
                      Open to add more charges to this bill
                    </button>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-text">Record Payment</p>
                      {paymentInvoiceOptions.length ? (
                        <div className="grid gap-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4 lg:grid-cols-2">
                          <Select
                            label="Invoice"
                            value={paymentInvoiceId}
                            onChange={(event) => setPaymentInvoiceId(event.target.value)}
                            options={paymentInvoiceOptions}
                          />
                          <Input
                            label="Amount"
                            type="number"
                            value={paymentAmount}
                            onChange={(event) => setPaymentAmount(event.target.value)}
                          />
                          <Input
                            label="Payment Date"
                            type="date"
                            value={paymentDate}
                            onChange={(event) => setPaymentDate(event.target.value)}
                          />
                          <Input
                            label="Method"
                            value={paymentMethod}
                            onChange={(event) => setPaymentMethod(event.target.value)}
                          />
                          <Input
                            label="Reference"
                            value={paymentReference}
                            onChange={(event) => setPaymentReference(event.target.value)}
                          />
                          <Input
                            label="Notes"
                            value={paymentNotes}
                            onChange={(event) => setPaymentNotes(event.target.value)}
                          />
                          <div className="flex items-end">
                            <Button onClick={submitPayment} disabled={paymentSubmitting}>
                              Record Payment
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                          <p className="text-xs text-text-muted">
                            All invoices are fully paid. Add extra charges to create a new bill while keeping existing bills.
                          </p>
                          <div className="grid gap-3 lg:grid-cols-2">
                            <Input
                              label="Additional Charge Amount"
                              type="number"
                              value={chargeAmount}
                              onChange={(event) => setChargeAmount(event.target.value)}
                            />
                            <Input
                              label="Charge Date"
                              type="date"
                              value={paymentDate}
                              onChange={(event) => setPaymentDate(event.target.value)}
                            />
                            <Input
                              label="Notes"
                              value={chargeNotes}
                              onChange={(event) => setChargeNotes(event.target.value)}
                            />
                            <div className="flex items-end">
                              <Button onClick={submitAdditionalCharge} disabled={chargeSubmitting}>
                                Create Additional Charge Bill
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
