import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

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
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true }
  });
  if (!order) return jsonError("Sales order not found", 404);

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
    const openQty = Math.max(orderLine.quantity - invoicedQty, 0);
    if (line.quantity > openQty) return jsonError("Invoice quantity exceeds open quantity", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.create({
      data: {
        companyId,
        salesOrderId: order.id,
        invoiceNumber: parsed.data.invoiceNumber,
        invoiceDate: parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate) : undefined,
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

    const updatedInvoiceLines = await tx.salesInvoiceLine.findMany({
      where: { soLineId: { in: order.lines.map((line) => line.id) } }
    });
    const updatedTotals = new Map<string, number>();
    updatedInvoiceLines.forEach((line) => {
      updatedTotals.set(line.soLineId, (updatedTotals.get(line.soLineId) ?? 0) + line.quantity);
    });

    const allInvoiced = order.lines.every((line) => (updatedTotals.get(line.id) ?? 0) >= line.quantity);
    let nextStatus = order.status;
    if (allInvoiced) {
      nextStatus = "INVOICED";
    } else if (order.status !== "DELIVERED" && order.status !== "DISPATCH") {
      nextStatus = "DISPATCH";
    }

    if (nextStatus !== order.status) {
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: nextStatus }
      });
    }

    return invoice;
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
