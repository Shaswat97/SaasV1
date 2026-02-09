import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
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
  if (order.status !== "DISPATCH") {
    return jsonError("Only dispatched orders can be marked delivered", 400);
  }

  const allDelivered = order.lines.every((line) => (line.deliveredQty ?? 0) >= line.quantity);
  if (!allDelivered) {
    return jsonError("All order lines must be fully delivered before marking as delivered", 400);
  }

  const updated = await prisma.salesOrder.update({
    where: { id: order.id },
    data: { status: "DELIVERED" }
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
