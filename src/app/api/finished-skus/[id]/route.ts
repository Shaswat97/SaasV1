import { prisma } from "@/lib/prisma";
import { skuSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const skuType = "FINISHED" as const;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const sku = await prisma.sku.findFirst({
    where: { id: params.id, companyId, type: skuType, deletedAt: null }
  });

  if (!sku) return jsonError("Finished SKU not found", 404);

  return jsonOk(sku);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = skuSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  if (parsed.data.preferredVendorId) {
    return jsonError("Finished SKUs cannot have a preferred vendor", 400);
  }

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const existing = await prisma.sku.findFirst({
    where: { id: params.id, companyId, type: skuType, deletedAt: null }
  });

  if (!existing) return jsonError("Finished SKU not found", 404);

  try {
    const sku = await prisma.sku.update({
      where: { id: params.id },
      data: { ...parsed.data }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Finished SKU",
      entityId: sku.id,
      summary: `Updated finished SKU ${sku.code} · ${sku.name}.`
    });

    return jsonOk(sku);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("SKU code already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.sku.findFirst({
    where: { id: params.id, companyId, type: skuType, deletedAt: null }
  });

  if (!existing) return jsonError("Finished SKU not found", 404);

  const sku = await prisma.sku.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Finished SKU",
    entityId: sku.id,
    summary: `Deleted finished SKU ${sku.code} · ${sku.name}.`
  });

  return jsonOk(sku);
}
