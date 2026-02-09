import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { computeAvailabilitySummary, reserveRawForSalesOrder } from "@/lib/sales-order";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!order) return jsonError("Purchase order not found", 404);
  if (order.status !== "DRAFT") return jsonError("Only DRAFT orders can be confirmed", 400);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: "PENDING" }
    });

    const allocations = await tx.purchaseOrderAllocation.findMany({
      where: { poLine: { purchaseOrderId: next.id } },
      include: { soLine: { include: { salesOrder: { include: { lines: true } } } } }
    });

    const orderMap = new Map<string, { id: string; lines: Array<{ id: string; skuId: string; quantity: number; deliveredQty: number | null }> }>();
    allocations.forEach((allocation) => {
      const so = allocation.soLine.salesOrder;
      if (!so || so.status !== "QUOTE") return;
      if (!orderMap.has(so.id)) {
        orderMap.set(so.id, {
          id: so.id,
          lines: so.lines.map((line) => ({
            id: line.id,
            skuId: line.skuId,
            quantity: line.quantity,
            deliveredQty: line.deliveredQty
          }))
        });
      }
    });

    for (const orderEntry of orderMap.values()) {
      const availability = await computeAvailabilitySummary({
        companyId,
        lines: orderEntry.lines,
        tx,
        excludeSoLineIds: orderEntry.lines.map((line) => line.id)
      });
      const hasShortage = availability.raw.some((raw) => raw.shortageQty > 0);
      if (!hasShortage) {
        await reserveRawForSalesOrder({ companyId, availability, tx });
      }
      await tx.salesOrder.update({
        where: { id: orderEntry.id },
        data: { status: "CONFIRMED" }
      });
    }

    return next;
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Purchase Order",
    entityId: updated.id,
    summary: `Confirmed PO ${updated.poNumber ?? updated.id}.`
  });

  return jsonOk(updated);
}
