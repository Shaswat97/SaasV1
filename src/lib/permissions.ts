import type { PrismaClient } from "@prisma/client";
import { jsonError } from "@/lib/api-helpers";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { resolveAuthContext } from "@/lib/auth";
import { getActorFromRequest } from "@/lib/activity";

export type AdminContext = {
  companyId: string;
  actorName: string;
  actorEmployeeId: string | null;
  isAdmin: boolean;
};

export async function getAdminContext(
  request: Request,
  db?: PrismaClient
): Promise<AdminContext> {
  const prisma = db ?? (await getTenantPrisma(request));
  if (!prisma) {
    throw new Error("Tenant not found");
  }
  const auth = await resolveAuthContext(request, prisma);
  if (!auth) {
    return {
      companyId: "",
      actorName: "Anonymous",
      actorEmployeeId: null,
      isAdmin: false
    };
  }
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  return {
    companyId: auth.companyId,
    actorName: actorName || auth.employeeName,
    actorEmployeeId: auth.employeeId ?? actorEmployeeId,
    isAdmin: auth.isAdmin
  };
}

export type PermissionContext = {
  companyId: string;
  actorName: string;
  actorEmployeeId: string;
  permissions: string[];
  isAdmin: boolean;
};

export async function getPermissionContext(
  request: Request,
  db?: PrismaClient
): Promise<PermissionContext | null> {
  const prisma = db ?? (await getTenantPrisma(request));
  if (!prisma) {
    throw new Error("Tenant not found");
  }
  const auth = await resolveAuthContext(request, prisma);
  if (!auth) return null;
  return {
    companyId: auth.companyId,
    actorName: auth.employeeName,
    actorEmployeeId: auth.employeeId,
    permissions: auth.permissions,
    isAdmin: auth.isAdmin
  };
}

export async function requirePermission(
  request: Request,
  permission: string,
  db?: PrismaClient
) {
  const prisma = db ?? (await getTenantPrisma(request));
  if (!prisma) return { error: jsonError("Tenant not found", 404), prisma: null, context: null };
  const context = await getPermissionContext(request, prisma);
  if (!context) return { error: jsonError("Authentication required", 401), prisma, context: null };
  if (!context.isAdmin && !context.permissions.includes(permission)) {
    return { error: jsonError("Forbidden", 403), prisma, context };
  }
  return { error: null, prisma, context };
}

export async function requireAnyPermission(
  request: Request,
  permissions: string[],
  db?: PrismaClient
) {
  const prisma = db ?? (await getTenantPrisma(request));
  if (!prisma) return { error: jsonError("Tenant not found", 404), prisma: null, context: null };
  const context = await getPermissionContext(request, prisma);
  if (!context) return { error: jsonError("Authentication required", 401), prisma, context: null };
  if (!context.isAdmin && !permissions.some((permission) => context.permissions.includes(permission))) {
    return { error: jsonError("Forbidden", 403), prisma, context };
  }
  return { error: null, prisma, context };
}
