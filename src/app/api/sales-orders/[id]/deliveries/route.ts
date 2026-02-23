import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { recordStockMovement } from "@/lib/stock-service";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const deliveryLineSchema = z.object({
  lineId: z.string().min(1),
  quantity: z.number().positive("Quantity must be greater than 0"),
  packagingCost: z.number().min(0, "Delivery cost is required"),
  deliveryDate: z.string().datetime("Delivery date is required"),
  notes: z.string().optional()
});

const deliverySchema = z.object({
  lines: z.array(deliveryLineSchema).min(1, "Add at least one delivery line")
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "sales.deliver");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = deliverySchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);
  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true }
  });
  if (!order) return jsonError("Sales order not found", 404);
  if (order.status !== "DISPATCH") {
    return jsonError("Only dispatched orders can record deliveries", 400);
  }

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
          packagingCost: line.packagingCost,
          deliveryDate: new Date(line.deliveryDate),
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

    const refreshedLines = await tx.salesOrderLine.findMany({
      where: { salesOrderId: order.id },
      select: { quantity: true, deliveredQty: true }
    });
    const allDelivered = refreshedLines.every((line) => (line.deliveredQty ?? 0) >= line.quantity);
    const nextStatus = allDelivered ? "DELIVERED" : "DISPATCH";
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
