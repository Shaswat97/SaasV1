import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { computeAvailabilitySummary, reserveRawForSalesOrder } from "@/lib/sales-order";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true }
  });

  if (!order) return jsonError("Sales order not found", 404);
  if (order.status !== "QUOTE") return jsonError("Only quotes can be confirmed", 400);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const availability = await computeAvailabilitySummary({
        companyId,
        lines: order.lines.map((line) => ({
          id: line.id,
          skuId: line.skuId,
          quantity: line.quantity,
          deliveredQty: line.deliveredQty
        })),
        tx,
        excludeSoLineIds: order.lines.map((line) => line.id)
      });

      const hasShortage = availability.raw.some((raw) => raw.shortageQty > 0);
      if (hasShortage) {
        throw new Error("Insufficient raw material to confirm this order");
      }

      await reserveRawForSalesOrder({ companyId, availability, tx });

      return tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
        include: { lines: true }
      });
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Sales Order",
      entityId: updated.id,
      summary: `Confirmed sales order ${updated.soNumber ?? updated.id}.`
    });

    return jsonOk(updated);
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to confirm order");
  }
}
