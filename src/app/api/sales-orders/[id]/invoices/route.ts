import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function lineNetTotal(line: { quantity: number; unitPrice: number; discountPct?: number | null; taxPct?: number | null }) {
  const discount = line.discountPct ?? 0;
  const tax = line.taxPct ?? 0;
  const discounted = line.unitPrice * (1 - discount / 100);
  return line.quantity * discounted * (1 + tax / 100);
}

async function buildInvoiceNumber(prisma: ReturnType<typeof getTenantPrisma> extends Promise<infer T> ? T : never, companyId: string, at: Date) {
  const yy = String(at.getFullYear()).slice(-2);
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const prefix = `INV-${yy}${mm}`;
  const count = await prisma!.salesInvoice.count({
    where: { companyId, invoiceNumber: { startsWith: prefix } }
  });
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
}

const invoiceLineSchema = z.object({
  lineId: z.string().min(1),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().optional(),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional()
});

const invoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, "Add at least one invoice line")
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "sales.invoice.create");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);
  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true, customer: true }
  });
  if (!order) return jsonError("Sales order not found", 404);
  if (!["DELIVERED", "INVOICED"].includes(order.status)) {
    return jsonError("Invoice can only be created after delivery", 400);
  }

  const lineMap = new Map(order.lines.map((line) => [line.id, line]));
  const invoiceLines = await prisma.salesInvoiceLine.findMany({
    where: { soLineId: { in: order.lines.map((line) => line.id) } }
  });

  const invoicedByLine = new Map<string, number>();
  invoiceLines.forEach((line) => {
    invoicedByLine.set(line.soLineId, (invoicedByLine.get(line.soLineId) ?? 0) + line.quantity);
  });

  for (const line of parsed.data.lines) {
    const orderLine = lineMap.get(line.lineId);
    if (!orderLine) return jsonError("Invoice line does not belong to this order", 400);
    const invoicedQty = invoicedByLine.get(line.lineId) ?? 0;
    const openQty = Math.max(orderLine.deliveredQty - invoicedQty, 0);
    if (line.quantity > openQty) return jsonError("Invoice quantity exceeds open quantity", 400);
  }

  const invoiceDate = parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate) : new Date();
  const invoiceNumber = parsed.data.invoiceNumber ?? (await buildInvoiceNumber(prisma, companyId, invoiceDate));
  const creditDays = order.creditDays ?? order.customer?.creditDays ?? 0;
  const dueDate = creditDays > 0 ? new Date(invoiceDate.getTime() + creditDays * 86400000) : null;

  const updated = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.create({
      data: {
        companyId,
        salesOrderId: order.id,
        invoiceNumber,
        invoiceDate,
        dueDate: dueDate ?? undefined,
        currency: order.currency,
        notes: parsed.data.notes,
        lines: {
          create: parsed.data.lines.map((line) => {
            const orderLine = lineMap.get(line.lineId)!;
            return {
              soLineId: line.lineId,
              skuId: orderLine.skuId,
              quantity: line.quantity,
              unitPrice: line.unitPrice ?? orderLine.unitPrice,
              discountPct: line.discountPct ?? orderLine.discountPct ?? 0,
              taxPct: line.taxPct ?? orderLine.taxPct ?? 0
            };
          })
        }
      },
      include: { lines: true }
    });

    const totalAmount = invoice.lines.reduce((sum, line) => sum + lineNetTotal(line), 0);
    const balanceAmount = totalAmount;

    await tx.salesInvoice.update({
      where: { id: invoice.id },
      data: {
        totalAmount,
        balanceAmount,
        status: balanceAmount > 0 ? "UNPAID" : "PAID"
      }
    });

    const updatedInvoiceLines = await tx.salesInvoiceLine.findMany({
      where: { soLineId: { in: order.lines.map((line) => line.id) } }
    });
    const updatedTotals = new Map<string, number>();
    updatedInvoiceLines.forEach((line) => {
      updatedTotals.set(line.soLineId, (updatedTotals.get(line.soLineId) ?? 0) + line.quantity);
    });

    const allInvoiced = order.lines.every((line) => (updatedTotals.get(line.id) ?? 0) >= line.deliveredQty);
    let nextStatus = order.status;
    if (allInvoiced && order.status === "DELIVERED") {
      nextStatus = "INVOICED";
    }

    if (nextStatus !== order.status) {
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: nextStatus }
      });
    }

    return {
      ...invoice,
      totalAmount,
      balanceAmount,
      status: balanceAmount > 0 ? "UNPAID" : "PAID"
    };
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Invoice",
    entityId: updated.id,
    summary: `Created invoice for sales order ${order.soNumber ?? order.id}.`
  });

  return jsonOk(updated);
}
