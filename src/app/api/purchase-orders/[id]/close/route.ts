import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const closeSchema = z.object({
  reason: z.string().optional()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = closeSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true }
  });

  if (!order) return jsonError("Purchase order not found", 404);
  if (["CANCELLED", "RECEIVED", "CLOSED"].includes(order.status)) {
    return jsonError("Completed or cancelled orders cannot be closed", 400);
  }
  if (order.status !== "APPROVED") {
    return jsonError("Only approved orders can be closed", 400);
  }

  const remainingLines = order.lines.filter((line) => line.receivedQty < line.quantity);

  const updated = await prisma.$transaction(async (tx) => {
    await Promise.all(
      remainingLines.map((line) =>
        tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { shortClosedQty: line.quantity - line.receivedQty }
        })
      )
    );

    return tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closeReason: parsed.data.reason ?? undefined
      },
      include: { vendor: true, lines: { include: { sku: true } }, receipts: true }
    });
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Purchase Order",
    entityId: updated.id,
    summary: `Closed PO ${updated.poNumber ?? updated.id} with ${remainingLines.length} line(s) short closed.`
  });

  return jsonOk(updated);
}
