import { getTenantPrisma } from "@/lib/tenant-prisma";
import { warehouseSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!warehouse) return jsonError("Warehouse not found", 404);

  return jsonOk(warehouse);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = warehouseSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const existing = await prisma.warehouse.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Warehouse not found", 404);

  try {
    const warehouse = await prisma.warehouse.update({
      where: { id: params.id },
      data: { ...parsed.data }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Warehouse",
      entityId: warehouse.id,
      summary: `Updated warehouse ${warehouse.code} · ${warehouse.name}.`
    });

    return jsonOk(warehouse);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Warehouse code already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.warehouse.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Warehouse not found", 404);

  const warehouse = await prisma.warehouse.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Warehouse",
    entityId: warehouse.id,
    summary: `Deleted warehouse ${warehouse.code} · ${warehouse.name}.`
  });

  return jsonOk(warehouse);
}
