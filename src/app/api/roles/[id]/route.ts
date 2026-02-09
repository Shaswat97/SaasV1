import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const role = await prisma.role.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!role) return jsonError("Role not found", 404);

  return jsonOk(role);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const role = await prisma.role.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!role) return jsonError("Role not found", 404);

  const updated = await prisma.role.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Role",
    entityId: updated.id,
    summary: `Deleted role ${updated.name}.`
  });

  return jsonOk(updated);
}
