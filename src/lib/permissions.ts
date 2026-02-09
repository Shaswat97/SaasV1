import { prisma } from "@/lib/prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest } from "@/lib/activity";

export type AdminContext = {
  companyId: string;
  actorName: string;
  actorEmployeeId: string | null;
  isAdmin: boolean;
};

export async function getAdminContext(request: Request): Promise<AdminContext> {
  const companyId = await getDefaultCompanyId();
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
