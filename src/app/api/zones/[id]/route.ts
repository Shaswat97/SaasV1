import { prisma } from "@/lib/prisma";
import { zoneSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const zone = await prisma.zone.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { warehouse: true }
  });

  if (!zone) return jsonError("Zone not found", 404);

  return jsonOk(zone);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = zoneSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const existing = await prisma.zone.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Zone not found", 404);

  if (parsed.data.warehouseId) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: parsed.data.warehouseId, companyId, deletedAt: null }
    });

    if (!warehouse) return jsonError("Warehouse not found", 404);
  }

  try {
    const zone = await prisma.zone.update({
      where: { id: params.id },
      data: { ...parsed.data }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Zone",
      entityId: zone.id,
      summary: `Updated zone ${zone.code} · ${zone.name}.`
    });

    return jsonOk(zone);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Zone code already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.zone.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Zone not found", 404);

  const zone = await prisma.zone.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Zone",
    entityId: zone.id,
    summary: `Deleted zone ${zone.code} · ${zone.name}.`
  });

  return jsonOk(zone);
}
