import type { Prisma, PrismaClient } from "@prisma/client";
import {
  DEFAULT_ROLE_NAMES,
  DEFAULT_ROLE_PERMISSIONS,
  normalizePermissions,
  PERMISSION_DEFINITIONS
} from "@/lib/rbac";

type Db = PrismaClient | Prisma.TransactionClient;

export async function ensureDefaultRoles(db: Db, companyId: string) {
  for (const roleName of DEFAULT_ROLE_NAMES) {
    const permissions = normalizePermissions(DEFAULT_ROLE_PERMISSIONS[roleName]);
    const existing = await db.role.findUnique({
      where: { companyId_name: { companyId, name: roleName } }
    });
    if (!existing) {
      await db.role.create({
        data: {
          companyId,
          name: roleName,
          permissions
        }
      });
      continue;
    }
    if (existing.permissions.length === 0) {
      await db.role.update({
        where: { id: existing.id },
        data: { permissions }
      });
    }
  }
}

export function getGroupedPermissionCatalog() {
  const groups = new Map<string, Array<{ key: string; label: string }>>();
  for (const permission of PERMISSION_DEFINITIONS) {
    const current = groups.get(permission.group) ?? [];
    current.push({ key: permission.key, label: permission.label });
    groups.set(permission.group, current);
  }
  return [...groups.entries()].map(([group, permissions]) => ({ group, permissions }));
}
