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
  if (order.status !== "PRODUCTION") return jsonError("Only production orders can be dispatched", 400);

  const updated = await prisma.salesOrder.update({
    where: { id: order.id },
    data: { status: "DISPATCH" },
    include: { lines: true }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Sales Order",
    entityId: updated.id,
    summary: `Dispatched sales order ${updated.soNumber ?? updated.id}.`
  });

  return jsonOk(updated);
}
