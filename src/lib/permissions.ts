import type { Prisma, PrismaClient } from "@prisma/client";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest } from "@/lib/activity";

export type AdminContext = {
  companyId: string;
  actorName: string;
  actorEmployeeId: string | null;
  isAdmin: boolean;
};

export async function getAdminContext(
  request: Request,
  db?: Prisma.TransactionClient | PrismaClient
): Promise<AdminContext> {
  const prisma = db ?? (await getTenantPrisma(request));
  if (!prisma) {
    throw new Error("Tenant not found");
  }
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  if (!actorEmployeeId) {
    return { companyId, actorName, actorEmployeeId, isAdmin: false };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: actorEmployeeId, companyId, deletedAt: null },
    include: { roles: { include: { role: true } } }
  });

  const isAdmin = Boolean(employee?.roles?.some((role) => role.role.name === "ADMIN"));

  return { companyId, actorName, actorEmployeeId, isAdmin };
}
