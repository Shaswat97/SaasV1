import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";
import { recordStockMovement } from "@/lib/stock-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/sales-orders/[id]/skip-production
 *
 * Moves a CONFIRMED order directly to DISPATCH status by fulfilling
 * demand from existing finished goods stock rather than starting production.
 *
 * For each order line the API:
 *  1. Checks that the finished-goods zone has enough onHand qty.
 *  2. Records a stock OUT movement (SALES_DISPATCH) from the finished zone.
 *  3. Sets producedQty on the line to the fulfilled quantity so that
 *     the existing dispatch / delivery / invoice flow works unchanged.
 *
 * Returns an error if any line cannot be fully covered by on-hand stock.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const guard = await requirePermission(request, "sales.dispatch");
    if (guard.error) return guard.error;
    const prisma = guard.prisma;
    if (!prisma) return jsonError("Tenant not found", 404);
    const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
    const { actorName, actorEmployeeId } = guard.context
        ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
        : getActorFromRequest(request);

    // Load the order
    const order = await prisma.salesOrder.findFirst({
        where: { id: params.id, companyId, deletedAt: null },
        include: { lines: { include: { sku: true } } }
    });

    if (!order) return jsonError("Sales order not found", 404);
    if (order.status !== "CONFIRMED") {
        return jsonError("Only confirmed orders can use finished stock dispatch", 400);
    }

    // Find the finished-goods zone (type FINISHED or DISPATCH; fall back to any non-SCRAP/RAW zone)
    const finishedZone = await prisma.zone.findFirst({
        where: {
            companyId,
            active: true,
            deletedAt: null,
            type: { in: ["FINISHED", "DISPATCH"] }
        },
        orderBy: { createdAt: "asc" }
    });

    if (!finishedZone) {
        return jsonError(
            "No active Finished Goods zone found. Create a zone of type FINISHED in Settings before using this option.",
            400
        );
    }

    // For each line, check that finished stock on hand >= open qty
    const openLines = order.lines.map((line) => ({
        line,
        openQty: Math.max(line.quantity - (line.deliveredQty ?? 0), 0)
    }));

    const skuIds = openLines.map((l) => l.line.skuId);
    const balances = await prisma.stockBalance.findMany({
        where: { companyId, zoneId: finishedZone.id, skuId: { in: skuIds } }
    });
    const balanceMap = new Map(balances.map((b) => [b.skuId, b]));

    const shortages = openLines.filter((l) => {
        const onHand = balanceMap.get(l.line.skuId)?.quantityOnHand ?? 0;
        return onHand < l.openQty;
    });

    if (shortages.length > 0) {
        const msgs = shortages.map((s) => {
            const onHand = balanceMap.get(s.line.skuId)?.quantityOnHand ?? 0;
            return `${s.line.sku.code} · ${s.line.sku.name}: need ${s.openQty}, on hand ${onHand}`;
        });
        return jsonError(
            `Insufficient finished stock for the following SKUs:\n${msgs.join("\n")}`,
            400
        );
    }

    // All lines are covered — execute inside a transaction
    const updated = await prisma.$transaction(async (tx) => {
        for (const { line, openQty } of openLines) {
            if (openQty <= 0) continue;

            const balance = balanceMap.get(line.skuId);
            const costPerUnit = balance?.costPerUnit ?? 0;

            // Deduct finished stock
            await recordStockMovement(
                {
                    companyId,
                    skuId: line.skuId,
                    zoneId: finishedZone.id,
                    quantity: openQty,
                    direction: "OUT",
                    movementType: "ISSUE",
                    costPerUnit,
                    referenceType: "SALES_ORDER",
                    referenceId: order.id,
                    notes: `Fulfilled directly from finished stock for order ${order.soNumber ?? order.id}`
                },
                tx
            );

            // Mark the line as "produced" so dispatch/delivery flow is satisfied
            await tx.salesOrderLine.update({
                where: { id: line.id },
                data: { producedQty: (line.producedQty ?? 0) + openQty }
            });
        }

        // Advance to DISPATCH
        return tx.salesOrder.update({
            where: { id: order.id },
            data: { status: "DISPATCH" },
            include: { lines: true }
        });
    });

    await recordActivity({
        companyId,
        actorName,
        actorEmployeeId,
        action: "UPDATE",
        entityType: "Sales Order",
        entityId: updated.id,
        summary: `Dispatched sales order ${updated.soNumber ?? updated.id} from finished stock (skipped production).`
    });

    return jsonOk(updated);
}
