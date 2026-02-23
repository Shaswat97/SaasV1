import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { recordStockMovement } from "@/lib/stock-service";
import { recordActivity } from "@/lib/activity";
import { getAdminContext } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const cycleSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  zoneId: z.string().min(1, "Zone is required"),
  countedQty: z.number().nonnegative("Counted quantity must be 0 or more"),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = cycleSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { companyId, actorName, actorEmployeeId, isAdmin } = await getAdminContext(request);
  if (!isAdmin) {
    return jsonError("Admin permission required.", 403);
  }

  const balance = await prisma.stockBalance.findUnique({
    where: {
      companyId_skuId_zoneId: {
        companyId,
        skuId: parsed.data.skuId,
        zoneId: parsed.data.zoneId
      }
    },
    include: { sku: true, zone: true }
  });

  const currentQty = balance?.quantityOnHand ?? 0;
  const delta = parsed.data.countedQty - currentQty;

  if (delta === 0) {
    return jsonOk({ adjusted: false, message: "No change" });
  }

  try {
    const movement = await recordStockMovement({
      companyId,
      skuId: parsed.data.skuId,
      zoneId: parsed.data.zoneId,
      quantity: Math.abs(delta),
      direction: delta > 0 ? "IN" : "OUT",
      movementType: "ADJUSTMENT",
      costPerUnit: balance?.costPerUnit ?? 0,
      referenceType: "CYCLE_COUNT",
      notes: parsed.data.notes
    });

    const skuLabel = balance?.sku ? `${balance.sku.code} · ${balance.sku.name}` : parsed.data.skuId;
    const zoneLabel = balance?.zone ? balance.zone.name : parsed.data.zoneId;

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Inventory",
      entityId: parsed.data.skuId,
      summary: `Cycle count adjusted ${skuLabel} in ${zoneLabel} from ${currentQty} to ${parsed.data.countedQty}.`
    });

    return jsonOk({ adjusted: true, movement });
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to post cycle count", 400);
  }
}
