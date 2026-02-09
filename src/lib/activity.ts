import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export async function recordActivity(input: ActivityInput, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
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
