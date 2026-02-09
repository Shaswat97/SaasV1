import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { recordStockMovement } from "@/lib/stock-service";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const deliveryLineSchema = z.object({
  lineId: z.string().min(1),
  quantity: z.number().positive("Quantity must be greater than 0"),
  packagingCost: z.number().min(0).optional(),
  deliveryDate: z.string().datetime().optional(),
  notes: z.string().optional()
});

const deliverySchema = z.object({
  lines: z.array(deliveryLineSchema).min(1, "Add at least one delivery line")
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = deliverySchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true }
  });
  if (!order) return jsonError("Sales order not found", 404);

  const lineMap = new Map(order.lines.map((line) => [line.id, line]));

  for (const line of parsed.data.lines) {
    const orderLine = lineMap.get(line.lineId);
    if (!orderLine) return jsonError("Delivery line does not belong to this order", 400);
    const openQty = Math.max(orderLine.quantity - orderLine.deliveredQty, 0);
    if (line.quantity > openQty) return jsonError("Delivery quantity exceeds open quantity", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const zones = await tx.zone.findMany({
      where: { companyId, deletedAt: null, type: { in: ["FINISHED", "IN_TRANSIT"] } }
    });
    const finishedZone = zones.find((zone) => zone.type === "FINISHED");
    const transitZone = zones.find((zone) => zone.type === "IN_TRANSIT");
    if (!finishedZone || !transitZone) {
      throw new Error("Finished and In Transit zones must exist before delivery");
    }

    for (const line of parsed.data.lines) {
      await tx.salesOrderDelivery.create({
        data: {
          companyId,
          salesOrderId: order.id,
          soLineId: line.lineId,
          quantity: line.quantity,
          packagingCost: line.packagingCost ?? 0,
          deliveryDate: line.deliveryDate ? new Date(line.deliveryDate) : undefined,
          notes: line.notes
        }
      });

      await tx.salesOrderLine.update({
        where: { id: line.lineId },
        data: { deliveredQty: { increment: line.quantity } }
      });

      const outbound = await recordStockMovement(
        {
          companyId,
          skuId: lineMap.get(line.lineId)!.skuId,
          zoneId: finishedZone.id,
          quantity: line.quantity,
          direction: "OUT",
          movementType: "TRANSFER",
          referenceType: "DELIVERY",
          referenceId: order.id,
          notes: "Delivery dispatched from finished stock"
        },
        tx
      );

      await recordStockMovement(
        {
          companyId,
          skuId: lineMap.get(line.lineId)!.skuId,
          zoneId: transitZone.id,
          quantity: line.quantity,
          direction: "IN",
          movementType: "TRANSFER",
          costPerUnit: outbound.costPerUnit,
          referenceType: "DELIVERY",
          referenceId: order.id,
          notes: "Delivery moved to in transit"
        },
        tx
      );
    }

    const nextStatus = ["CONFIRMED", "PRODUCTION"].includes(order.status) ? "DISPATCH" : order.status;
    if (nextStatus !== order.status) {
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: nextStatus }
      });
    }

    return tx.salesOrder.findUnique({
      where: { id: order.id },
      include: {
        customer: true,
        lines: { include: { sku: true } },
        deliveries: { include: { line: { include: { sku: true } } } }
      }
    });
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Delivery",
    entityId: order.id,
    summary: `Recorded delivery for sales order ${order.soNumber ?? order.id}.`
  });

  return jsonOk(updated);
}
