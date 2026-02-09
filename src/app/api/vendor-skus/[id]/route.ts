import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const updateSchema = z.object({
  lastPrice: z.number().nonnegative().optional()
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.vendorSku.findFirst({
    where: { id: params.id, companyId },
    include: { vendor: true, sku: true }
  });
  if (!existing) return jsonError("Vendor SKU not found", 404);

  const updated = await prisma.vendorSku.update({
    where: { id: existing.id },
    data: { lastPrice: parsed.data.lastPrice },
    include: { vendor: true, sku: true }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Vendor",
    entityId: updated.vendorId,
    summary: `Updated vendor price for ${updated.sku.code} · ${updated.sku.name}.`
  });

  return jsonOk(updated);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.vendorSku.findFirst({
    where: { id: params.id, companyId },
    include: { vendor: true, sku: true }
  });
  if (!existing) return jsonError("Vendor SKU not found", 404);

  await prisma.vendorSku.delete({ where: { id: existing.id } });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Vendor",
    entityId: existing.vendorId,
    summary: `Unlinked ${existing.sku.code} · ${existing.sku.name} from vendor ${existing.vendor.code}.`
  });

  return jsonOk({ deleted: true });
}
