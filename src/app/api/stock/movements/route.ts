import { z } from "zod";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { recordStockMovement } from "@/lib/stock-service";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const movementSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  zoneId: z.string().min(1, "Zone is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  direction: z.enum(["IN", "OUT"]),
  movementType: z.enum(["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT", "PRODUCE"]),
  costPerUnit: z.number().nonnegative().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
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

  const parsed = movementSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const movement = await recordStockMovement({
      companyId,
      skuId: parsed.data.skuId,
      zoneId: parsed.data.zoneId,
      quantity: parsed.data.quantity,
      direction: parsed.data.direction,
      movementType: parsed.data.movementType,
      costPerUnit: parsed.data.costPerUnit,
      referenceType: parsed.data.referenceType,
      referenceId: parsed.data.referenceId,
      notes: parsed.data.notes
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Inventory",
      entityId: parsed.data.skuId,
      summary: `Stock ${parsed.data.movementType.toLowerCase()} (${parsed.data.direction}) for SKU ${parsed.data.skuId}.`
    });

    return jsonOk(movement, { status: 201 });
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to record movement", 400);
  }
}
