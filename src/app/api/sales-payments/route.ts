import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentDate: z.string().datetime().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional()
});

export async function GET(request: Request) {
  const guard = await requirePermission(request, "sales.view");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId") || undefined;
  const invoiceId = searchParams.get("invoiceId") || undefined;
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));

  const payments = await prisma.salesPayment.findMany({
    where: {
      companyId,
      ...(customerId ? { customerId } : {}),
      ...(invoiceId ? { allocations: { some: { invoiceId } } } : {})
    },
    include: {
      customer: { select: { id: true, code: true, name: true } },
      allocations: {
        include: {
          invoice: { select: { id: true, invoiceNumber: true, salesOrderId: true } }
        }
      }
    },
    orderBy: { paymentDate: "desc" }
  });

  return jsonOk(payments);
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "sales.payment.record");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = paymentSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: parsed.data.invoiceId, companyId },
    include: { salesOrder: true }
  });

  if (!invoice) return jsonError("Invoice not found", 404);
  if (invoice.balanceAmount <= 0) return jsonError("Invoice already paid", 400);
  if (parsed.data.amount > invoice.balanceAmount) return jsonError("Payment exceeds outstanding balance", 400);

  const paymentDate = parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.salesPayment.create({
      data: {
        companyId,
        customerId: invoice.salesOrder.customerId,
        paymentDate,
        amount: parsed.data.amount,
        method: parsed.data.method,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        allocations: {
          create: [
            {
              companyId,
              invoiceId: invoice.id,
              amount: parsed.data.amount
            }
          ]
        }
      },
      include: { allocations: true }
    });

    const newBalance = Math.max(invoice.balanceAmount - parsed.data.amount, 0);
    const nextStatus = newBalance === 0 ? "PAID" : "PARTIALLY_PAID";
    await tx.salesInvoice.update({
      where: { id: invoice.id },
      data: { balanceAmount: newBalance, status: nextStatus }
    });

    return payment;
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Payment",
    entityId: updated.id,
    summary: `Recorded payment against invoice ${invoice.invoiceNumber ?? invoice.id}.`
  });

  return jsonOk(updated, { status: 201 });
}
