import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const paymentSchema = z.object({
  billId: z.string().min(1, "Bill is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentDate: z.string().datetime().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional()
});

export async function GET(request: Request) {
  const guard = await requirePermission(request, "purchase.view");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId") || undefined;
  const billId = searchParams.get("billId") || undefined;
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));

  const payments = await prisma.vendorPayment.findMany({
    where: {
      companyId,
      ...(vendorId ? { vendorId } : {}),
      ...(billId ? { allocations: { some: { billId } } } : {})
    },
    include: {
      vendor: { select: { id: true, code: true, name: true } },
      allocations: {
        include: {
          bill: { select: { id: true, billNumber: true, purchaseOrderId: true } }
        }
      }
    },
    orderBy: { paymentDate: "desc" }
  });

  return jsonOk(payments);
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "vendor.payment.record");
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
  const bill = await prisma.vendorBill.findFirst({
    where: { id: parsed.data.billId, companyId },
    include: { vendor: true }
  });

  if (!bill) return jsonError("Bill not found", 404);
  if (bill.balanceAmount <= 0) return jsonError("Bill already paid", 400);
  if (parsed.data.amount > bill.balanceAmount) return jsonError("Payment exceeds outstanding balance", 400);

  const paymentDate = parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.vendorPayment.create({
      data: {
        companyId,
        vendorId: bill.vendorId,
        paymentDate,
        amount: parsed.data.amount,
        method: parsed.data.method,
        reference: parsed.data.reference,
        notes: parsed.data.notes,
        allocations: {
          create: [
            {
              companyId,
              billId: bill.id,
              amount: parsed.data.amount
            }
          ]
        }
      },
      include: { allocations: true }
    });

    const newBalance = Math.max(bill.balanceAmount - parsed.data.amount, 0);
    const nextStatus = newBalance === 0 ? "PAID" : "PARTIALLY_PAID";
    await tx.vendorBill.update({
      where: { id: bill.id },
      data: { balanceAmount: newBalance, status: nextStatus }
    });

    return payment;
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Vendor Payment",
    entityId: updated.id,
    summary: `Recorded vendor payment against bill ${bill.billNumber ?? bill.id}.`
  });

  return jsonOk(updated, { status: 201 });
}
