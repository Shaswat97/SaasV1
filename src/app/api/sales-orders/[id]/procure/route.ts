import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { autoDraftPurchaseOrders } from "@/lib/sales-order";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true }
  });

  if (!order) return jsonError("Sales order not found", 404);

  const result = await prisma.$transaction(async (tx) => {
    return autoDraftPurchaseOrders({
      companyId,
      salesOrderId: order.id,
      soNumber: order.soNumber,
      lines: order.lines.map((line) => ({
        id: line.id,
        skuId: line.skuId,
        quantity: line.quantity,
        deliveredQty: line.deliveredQty
      })),
      tx
    });
  });

  if (Array.isArray(result) && result.length > 0) {
    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Purchase Order",
      entityId: result[0]?.id ?? null,
      summary: `Auto-drafted purchase order(s) for sales order ${order.soNumber ?? order.id}.`
    });
  }

  return jsonOk(result);
}
