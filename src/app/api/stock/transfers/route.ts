import { z } from "zod";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { transferStock } from "@/lib/stock-service";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const transferSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  fromZoneId: z.string().min(1, "Source zone is required"),
  toZoneId: z.string().min(1, "Destination zone is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
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

  const parsed = transferSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  if (parsed.data.fromZoneId === parsed.data.toZoneId) {
    return jsonError("Source and destination zones must be different", 400);
  }

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    await transferStock({
      companyId,
      skuId: parsed.data.skuId,
      fromZoneId: parsed.data.fromZoneId,
      toZoneId: parsed.data.toZoneId,
      quantity: parsed.data.quantity,
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
      summary: `Transferred ${parsed.data.quantity} from ${parsed.data.fromZoneId} to ${parsed.data.toZoneId}.`
    });

    return jsonOk({ ok: true });
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to transfer stock", 400);
  }
}
