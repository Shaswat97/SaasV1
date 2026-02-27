import { jsonOk } from "@/lib/api-helpers";
import { resolveAuthContext } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma(request);
  const auth = prisma ? await resolveAuthContext(request, prisma) : null;
  if (!auth) {
    return jsonOk({
      actorName: "Anonymous",
      actorEmployeeId: null,
      actorEmployeeCode: null,
      isAdmin: false,
      permissions: []
    });
  }

  return jsonOk({
    actorName: auth.employeeName,
    actorEmployeeId: auth.employeeId,
    actorEmployeeCode: auth.employeeCode,
    isAdmin: auth.isAdmin,
    permissions: auth.permissions
  });
}
