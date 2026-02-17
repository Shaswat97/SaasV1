import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";
import { recordStockMovement } from "@/lib/stock-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "sales.deliver");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);
  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true, deliveries: true }
  });

  if (!order) return jsonError("Sales order not found", 404);
  if (order.status !== "DISPATCH") {
    return jsonError("Only dispatched orders can be marked delivered", 400);
  }

  const allDelivered = order.lines.every((line) => (line.deliveredQty ?? 0) >= line.quantity);
  if (!allDelivered) {
    return jsonError("All order lines must be fully delivered before marking as delivered", 400);
  }
  if (!order.deliveries.length) {
    return jsonError("Record delivery details before marking as delivered", 400);
  }
  const deliveredByLine = new Map<string, number>();
  order.deliveries.forEach((delivery) => {
    deliveredByLine.set(delivery.soLineId, (deliveredByLine.get(delivery.soLineId) ?? 0) + delivery.quantity);
  });
  const missingDeliveryRows = order.lines.some(
    (line) => (deliveredByLine.get(line.id) ?? 0) < line.quantity
  );
  if (missingDeliveryRows) {
    return jsonError("Each line requires delivery records before marking as delivered", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const transitZone = await tx.zone.findFirst({
      where: { companyId, deletedAt: null, type: "IN_TRANSIT" },
      select: { id: true }
    });
    if (!transitZone) {
      throw new Error("In Transit zone not found");
    }

    for (const line of order.lines) {
      const qtyToIssue = Math.min(line.quantity, deliveredByLine.get(line.id) ?? 0);
      if (qtyToIssue <= 0) continue;

      await recordStockMovement(
        {
          companyId,
          skuId: line.skuId,
          zoneId: transitZone.id,
          quantity: qtyToIssue,
          direction: "OUT",
          movementType: "ISSUE",
          referenceType: "DELIVERY",
          referenceId: order.id,
          notes: "Final customer handover completed"
        },
        tx
      );
    }

    return tx.salesOrder.update({
      where: { id: order.id },
      data: { status: "DELIVERED" }
    });
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Sales Order",
    entityId: updated.id,
    summary: `Marked sales order ${updated.soNumber ?? updated.id} as delivered.`
  });

  return jsonOk(updated);
}
