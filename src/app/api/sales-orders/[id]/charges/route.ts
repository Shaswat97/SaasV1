import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const chargeSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  invoiceDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  lineId: z.string().optional()
});

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

  const parsed = chargeSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);

  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { customer: true, lines: true }
  });
  if (!order) return jsonError("Sales order not found", 404);
  if (!["DISPATCH", "DELIVERED", "INVOICED"].includes(order.status)) {
    return jsonError("Additional charges can only be added after dispatch", 400);
  }
  if (!order.lines.length) return jsonError("Sales order has no billable lines", 400);

  const targetLine =
    (parsed.data.lineId ? order.lines.find((line) => line.id === parsed.data.lineId) : order.lines[0]) ?? order.lines[0];
  if (!targetLine) return jsonError("Line not found for additional charge", 400);

  const invoiceDate = parsed.data.invoiceDate ? new Date(parsed.data.invoiceDate) : new Date();
  const creditDays = order.creditDays ?? order.customer?.creditDays ?? 0;
  const dueDate = creditDays > 0 ? new Date(invoiceDate.getTime() + creditDays * 86400000) : null;
  const invoiceNumber = await buildInvoiceNumber(prisma, companyId, invoiceDate);

  const lineTotal = lineNetTotal({
    quantity: 1,
    unitPrice: parsed.data.amount,
    discountPct: 0,
    taxPct: 0
  });

  const invoice = await prisma.salesInvoice.create({
    data: {
      companyId,
      salesOrderId: order.id,
      invoiceNumber,
      invoiceDate,
      dueDate: dueDate ?? undefined,
      status: "UNPAID",
      currency: order.currency,
      notes: parsed.data.notes?.trim() ? `Additional charge: ${parsed.data.notes.trim()}` : "Additional charge",
      totalAmount: lineTotal,
      balanceAmount: lineTotal,
      lines: {
        create: [
          {
            soLineId: targetLine.id,
            skuId: targetLine.skuId,
            quantity: 1,
            unitPrice: parsed.data.amount,
            discountPct: 0,
            taxPct: 0
          }
        ]
      }
    },
    include: { lines: true }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `Added additional charge invoice for sales order ${order.soNumber ?? order.id}.`
  });

  return jsonOk(invoice, { status: 201 });
}

