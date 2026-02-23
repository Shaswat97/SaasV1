import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { buildProcurementPlan, computeAvailabilitySummary, reserveRawForSalesOrder } from "@/lib/sales-order";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
const CURRENCY_EPSILON = 0.005;

const soLineSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().positive("Unit price must be greater than 0"),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional()
});

const soSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  soNumber: z.string().optional(),
  orderDate: z.string().datetime().optional(),
  creditDays: z.number().int().min(0).optional(),
  remindBeforeDays: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(soLineSchema).min(1, "Add at least one line")
});

function formatSoDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear() % 100).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

async function generateSoNumber(tx: Prisma.TransactionClient, companyId: string, date: Date) {
  const prefix = formatSoDate(date);
  const existing = await tx.salesOrder.findMany({
    where: {
      companyId,
      soNumber: { startsWith: `${prefix}-` }
    },
    select: { soNumber: true }
  });
  const max = existing.reduce((acc, row) => {
    if (!row.soNumber) return acc;
    const parts = row.soNumber.split("-");
    const raw = parts[parts.length - 1];
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value)) return acc;
    return Math.max(acc, value);
  }, 0);
  const next = String(max + 1).padStart(2, "0");
  return `${prefix}-${next}`;
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "sales.view");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));

  const orders = await prisma.salesOrder.findMany({
    where: { companyId, deletedAt: null },
    include: {
      customer: true,
      lines: { include: { sku: true } },
      deliveries: true,
      invoices: { include: { lines: true, payments: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const finishedStockBalances = await prisma.stockBalance.findMany({
    where: { companyId, quantityOnHand: { gt: 0 } },
    include: {
      sku: { select: { id: true, type: true } },
      zone: { select: { type: true } }
    }
  });

  const finishedOnHandBySku = new Map<string, number>();
  finishedStockBalances.forEach((balance) => {
    if (balance.sku.type !== "FINISHED") return;
    if (balance.zone.type !== "FINISHED") return;
    finishedOnHandBySku.set(balance.skuId, (finishedOnHandBySku.get(balance.skuId) ?? 0) + balance.quantityOnHand);
  });

  const normalizedOrders = await Promise.all(
    orders.map(async (order) => {
      if (order.status === "PRODUCTION") {
        const allProduced = order.lines.every((line) => (line.producedQty ?? 0) >= line.quantity);
        if (allProduced) {
          return prisma.salesOrder.update({
            where: { id: order.id },
            data: { status: "DISPATCH" },
            include: {
              customer: true,
              lines: { include: { sku: true } },
              deliveries: true,
              invoices: { include: { lines: true, payments: true } }
            }
          });
        }
      }
      if (order.status !== "DISPATCH") return order;
      const hasDeliveries = order.deliveries.length > 0;
      const allDelivered = order.lines.every((line) => (line.deliveredQty ?? 0) >= line.quantity);
      if (!hasDeliveries || !allDelivered) return order;
      return prisma.salesOrder.update({
        where: { id: order.id },
        data: { status: "DELIVERED" },
        include: {
          customer: true,
          lines: { include: { sku: true } },
          deliveries: true,
          invoices: { include: { lines: true, payments: true } }
        }
      });
    })
  );

  const enriched = normalizedOrders.map((order) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveredBySoLine = new Map(order.lines.map((line) => [line.id, line.deliveredQty ?? 0]));
    const totalInvoicedBySoLine = new Map<string, number>();
    order.invoices.forEach((invoice) => {
      invoice.lines.forEach((line) => {
        totalInvoicedBySoLine.set(line.soLineId, (totalInvoicedBySoLine.get(line.soLineId) ?? 0) + line.quantity);
      });
    });

    const coveredDuplicateDeliveryInvoiceIds = new Set<string>();
    order.invoices.forEach((invoice) => {
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
        coveredDuplicateDeliveryInvoiceIds.add(invoice.id);
      }
    });

    const invoiceTotals = order.invoices.reduce(
      (acc, invoice) => {
        if (coveredDuplicateDeliveryInvoiceIds.has(invoice.id)) {
          return acc;
        }
        const linesTotal = invoice.lines.reduce((sum, line) => {
          const discount = line.discountPct ?? 0;
          const tax = line.taxPct ?? 0;
          const discounted = line.unitPrice * (1 - discount / 100);
          return sum + line.quantity * discounted * (1 + tax / 100);
        }, 0);
        const invoiceTotal = invoice.totalAmount > 0 ? invoice.totalAmount : linesTotal;
        const paidAgainstInvoice = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
        const computedBalance = Math.max(invoiceTotal - paidAgainstInvoice, 0);
        let balance =
          invoice.balanceAmount > 0 || invoice.status === "PARTIALLY_PAID" || invoice.status === "UNPAID"
            ? invoice.balanceAmount
            : computedBalance;
        if (Math.abs(balance) < CURRENCY_EPSILON) {
          balance = 0;
        }
        if (balance > 0 && invoice.dueDate) {
          const due = new Date(invoice.dueDate);
          if (!Number.isNaN(due.getTime())) {
            acc.openInvoiceCount += 1;
            if (!acc.nextDueDate || due < acc.nextDueDate) {
              acc.nextDueDate = due;
            }
            const dueDay = new Date(due);
            dueDay.setHours(0, 0, 0, 0);
            if (dueDay < today) {
              acc.overdueInvoiceCount += 1;
              if (!acc.oldestOverdueDate || due < acc.oldestOverdueDate) {
                acc.oldestOverdueDate = due;
              }
            }
          }
        } else if (balance > 0) {
          acc.openInvoiceCount += 1;
        }
        return {
          total: acc.total + invoiceTotal,
          paid: acc.paid + Math.min(paidAgainstInvoice, invoiceTotal),
          outstanding: acc.outstanding + balance,
          nextDueDate: acc.nextDueDate,
          oldestOverdueDate: acc.oldestOverdueDate,
          openInvoiceCount: acc.openInvoiceCount,
          overdueInvoiceCount: acc.overdueInvoiceCount
        };
      },
      {
        total: 0,
        paid: 0,
        outstanding: 0,
        nextDueDate: null as Date | null,
        oldestOverdueDate: null as Date | null,
        openInvoiceCount: 0,
        overdueInvoiceCount: 0
      }
    );

    const paymentStatus =
      invoiceTotals.total <= 0
        ? "NOT_BILLED"
        : invoiceTotals.outstanding <= 0
          ? "PAID"
          : invoiceTotals.paid > 0
            ? "PARTIALLY_PAID"
            : "UNPAID";

    return {
      ...order,
      canUseFinishedStock:
        order.status === "CONFIRMED" &&
        order.lines.some((line) => {
          const openQty = Math.max((line.quantity ?? 0) - (line.deliveredQty ?? 0), 0);
          if (openQty <= 0) return false;
          const available = finishedOnHandBySku.get(line.skuId) ?? 0;
          return available > 0;
        }),
      payment: {
        totalBilled: invoiceTotals.total,
        totalPaid: invoiceTotals.paid,
        outstanding: invoiceTotals.outstanding,
        status: paymentStatus,
        nextDueDate: invoiceTotals.nextDueDate ? invoiceTotals.nextDueDate.toISOString() : null,
        oldestOverdueDate: invoiceTotals.oldestOverdueDate ? invoiceTotals.oldestOverdueDate.toISOString() : null,
        openInvoiceCount: invoiceTotals.openInvoiceCount,
        overdueInvoiceCount: invoiceTotals.overdueInvoiceCount
      }
    };
  });

  return jsonOk(enriched);
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "sales.create");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = soSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, companyId, deletedAt: null }
  });
  if (!customer) return jsonError("Customer not found", 404);

  const skuIds = parsed.data.lines.map((line) => line.skuId);
  const skus = await prisma.sku.findMany({
    where: { id: { in: skuIds }, companyId, deletedAt: null }
  });

  if (skus.length !== skuIds.length) {
    return jsonError("One or more SKUs are invalid", 400);
  }
  if (skus.some((sku) => sku.type !== "FINISHED")) {
    return jsonError("Sales order lines must reference FINISHED SKUs", 400);
  }

  const order = await prisma.$transaction(async (tx) => {
    const resolvedOrderDate = parsed.data.orderDate ? new Date(parsed.data.orderDate) : new Date();
    const resolvedSoNumber =
      parsed.data.soNumber && parsed.data.soNumber.trim().length > 0
        ? parsed.data.soNumber.trim()
        : await generateSoNumber(tx, companyId, resolvedOrderDate);
    const created = await tx.salesOrder.create({
      data: {
        companyId,
        customerId: parsed.data.customerId,
        soNumber: resolvedSoNumber,
        status: "QUOTE",
        orderDate: resolvedOrderDate,
        creditDays: parsed.data.creditDays ?? customer.creditDays ?? 0,
        remindBeforeDays: parsed.data.remindBeforeDays ?? customer.remindBeforeDays ?? 3,
        currency: parsed.data.currency ?? "INR",
        notes: parsed.data.notes,
        lines: {
          create: parsed.data.lines.map((line) => ({
            skuId: line.skuId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPct: line.discountPct ?? 0,
            taxPct: line.taxPct ?? 0
          }))
        }
      },
      include: {
        customer: true,
        lines: { include: { sku: true } }
      }
    });

    const availability = await computeAvailabilitySummary({
      companyId,
      lines: created.lines.map((line) => ({
        id: line.id,
        skuId: line.skuId,
        quantity: line.quantity,
        deliveredQty: line.deliveredQty
      })),
      tx
    });

    const hasShortage = availability.raw.some((raw) => raw.shortageQty > 0);
    if (!hasShortage) {
      await reserveRawForSalesOrder({ companyId, availability, tx });
      return tx.salesOrder.update({
        where: { id: created.id },
        data: { status: "CONFIRMED" },
        include: { customer: true, lines: { include: { sku: true } } }
      });
    }

    return created;
  });

  const availability = await computeAvailabilitySummary({
    companyId,
    lines: order.lines.map((line) => ({
      id: line.id,
      skuId: line.skuId,
      quantity: line.quantity,
      deliveredQty: line.deliveredQty
    })),
    excludeSoLineIds: order.lines.map((line) => line.id)
  });
  const procurementPlan = await buildProcurementPlan({
    companyId,
    lines: order.lines.map((line) => ({
      id: line.id,
      skuId: line.skuId,
      quantity: line.quantity,
      deliveredQty: line.deliveredQty
    })),
    availability,
    excludeSoLineIds: order.lines.map((line) => line.id)
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Sales Order",
    entityId: order.id,
    summary: `Created sales order ${order.soNumber ?? order.id} (${order.status}).`
  });

  return jsonOk({ ...order, availability, procurementPlan }, { status: 201 });
}
