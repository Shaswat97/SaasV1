import type { Prisma, PrismaClient } from "@prisma/client";
import { getTenantPrisma } from "@/lib/tenant-prisma";

export type ActivityInput = {
  companyId: string;
  actorName: string;
  actorEmployeeId?: string | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId?: string | null;
  summary: string;
};

export function getActorFromRequest(request: Request) {
  const actorName = request.headers.get("x-activity-user")?.trim() || "Admin";
  const actorEmployeeId = request.headers.get("x-activity-user-id")?.trim() || null;
  return { actorName, actorEmployeeId };
}

export async function recordActivity(
  input: ActivityInput,
  tx?: Prisma.TransactionClient | PrismaClient
) {
  const db = tx ?? (await getTenantPrisma());
  if (!db) {
    throw new Error("Tenant not found");
  }
  return db.activityLog.create({
    data: {
      companyId: input.companyId,
      actorName: input.actorName,
      actorEmployeeId: input.actorEmployeeId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary
    }
  });
}
