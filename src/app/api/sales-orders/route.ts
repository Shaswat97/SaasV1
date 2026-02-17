import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { buildProcurementPlan, computeAvailabilitySummary, reserveRawForSalesOrder } from "@/lib/sales-order";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

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
    const invoiceTotals = order.invoices.reduce(
      (acc, invoice) => {
        const linesTotal = invoice.lines.reduce((sum, line) => {
          const discount = line.discountPct ?? 0;
          const tax = line.taxPct ?? 0;
          const discounted = line.unitPrice * (1 - discount / 100);
          return sum + line.quantity * discounted * (1 + tax / 100);
        }, 0);
        const invoiceTotal = invoice.totalAmount > 0 ? invoice.totalAmount : linesTotal;
        const paidAgainstInvoice = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
        const balance = invoice.balanceAmount > 0 || invoice.status === "PARTIALLY_PAID" || invoice.status === "UNPAID"
          ? invoice.balanceAmount
          : Math.max(invoiceTotal - paidAgainstInvoice, 0);
        return {
          total: acc.total + invoiceTotal,
          paid: acc.paid + Math.min(paidAgainstInvoice, invoiceTotal),
          outstanding: acc.outstanding + balance
        };
      },
      { total: 0, paid: 0, outstanding: 0 }
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
      payment: {
        totalBilled: invoiceTotals.total,
        totalPaid: invoiceTotals.paid,
        outstanding: invoiceTotals.outstanding,
        status: paymentStatus
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
