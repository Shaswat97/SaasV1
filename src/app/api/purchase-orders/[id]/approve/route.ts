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
  if (order.status !== "PENDING") return jsonError("Only PENDING orders can be approved", 400);

  const updated = await prisma.purchaseOrder.update({
    where: { id: order.id },
    data: { status: "APPROVED" }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Purchase Order",
    entityId: updated.id,
    summary: `Approved PO ${updated.poNumber ?? updated.id}.`
  });

  return jsonOk(updated);
}
