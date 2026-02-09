import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true }
  });

  if (!order) return jsonError("Sales order not found", 404);
  if (order.status !== "CONFIRMED") return jsonError("Only confirmed orders can move to production", 400);

  const updated = await prisma.salesOrder.update({
    where: { id: order.id },
    data: { status: "PRODUCTION" },
    include: { lines: true }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Sales Order",
    entityId: updated.id,
    summary: `Moved sales order ${updated.soNumber ?? updated.id} to production.`
  });

  return jsonOk(updated);
}
