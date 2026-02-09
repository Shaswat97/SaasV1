import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!order) return jsonError("Purchase order not found", 404);
  if (order.status === "RECEIVED") return jsonError("Received orders cannot be cancelled", 400);

  const updated = await prisma.purchaseOrder.update({
    where: { id: order.id },
    data: { status: "CANCELLED" }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Purchase Order",
    entityId: updated.id,
    summary: `Cancelled PO ${updated.poNumber ?? updated.id}.`
  });

  return jsonOk(updated);
}
