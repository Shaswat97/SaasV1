import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { roleNameSchema, rolePermissionsSchema } from "@/lib/validation";
import { z } from "zod";
import { getDefaultCompanyId } from "@/lib/tenant";
import { recordActivity } from "@/lib/activity";
import { normalizePermissions } from "@/lib/rbac";
import { ensureDefaultRoles, getGroupedPermissionCatalog } from "@/lib/rbac-service";
import { requireAnyPermission, requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const rolePayloadSchema = z.object({
  name: roleNameSchema,
  permissions: rolePermissionsSchema
});

export async function GET(request: Request) {
  const guard = await requireAnyPermission(request, ["users.manage_roles", "users.manage_employees"]);
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const includeCatalog = searchParams.get("includeCatalog") === "true";
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  await ensureDefaultRoles(prisma, companyId);

  const roles = await prisma.role.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    orderBy: { createdAt: "asc" }
  });

  if (includeCatalog) {
    return jsonOk({ roles, permissionCatalog: getGroupedPermissionCatalog() });
  }

  return jsonOk(roles);
}

export async function POST(request: Request) {
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

  const parsed = rolePayloadSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const actorName = guard.context?.actorName ?? "Admin";
  const actorEmployeeId = guard.context?.actorEmployeeId ?? null;
  const normalizedName = parsed.data.name.trim().toUpperCase();
  const rolePermissions = normalizePermissions(parsed.data.permissions);
  if (rolePermissions.length === 0) {
    return jsonError("At least one permission is required", 400);
  }

  try {
    const role = await prisma.role.create({
      data: {
        companyId,
        name: normalizedName,
        permissions: rolePermissions
      }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Role",
      entityId: role.id,
      summary: `Created role ${role.name}.`
    });

    return jsonOk(role, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Role already exists", 409);
    }
    throw error;
  }
}
