import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { recordActivity } from "@/lib/activity";
import { roleNameSchema, rolePermissionsSchema } from "@/lib/validation";
import { normalizePermissions } from "@/lib/rbac";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const updateRoleSchema = z.object({
  name: roleNameSchema.optional(),
  permissions: rolePermissionsSchema.optional()
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "users.manage_roles");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const role = await prisma.role.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!role) return jsonError("Role not found", 404);

  return jsonOk(role);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "users.manage_roles");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }
  const parsed = updateRoleSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const actorName = guard.context?.actorName ?? "Admin";
  const actorEmployeeId = guard.context?.actorEmployeeId ?? null;
  const role = await prisma.role.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!role) return jsonError("Role not found", 404);

  const nextName = parsed.data.name ? parsed.data.name.trim().toUpperCase() : undefined;
  const nextPermissions = parsed.data.permissions ? normalizePermissions(parsed.data.permissions) : undefined;

  if (nextPermissions && nextPermissions.length === 0) {
    return jsonError("At least one permission is required", 400);
  }

  try {
    const updated = await prisma.role.update({
      where: { id: params.id },
      data: {
        name: nextName,
        permissions: nextPermissions
      }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Role",
      entityId: updated.id,
      summary: `Updated role ${updated.name}.`
    });

    return jsonOk(updated);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Role already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "users.manage_roles");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const actorName = guard.context?.actorName ?? "Admin";
  const actorEmployeeId = guard.context?.actorEmployeeId ?? null;

  const role = await prisma.role.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!role) return jsonError("Role not found", 404);

  if (role.name === "ADMIN") {
    return jsonError("Default ADMIN role cannot be deleted", 400);
  }

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
