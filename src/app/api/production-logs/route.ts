import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { searchParams } = new URL(request.url);
  const includeCancelled = searchParams.get("includeCancelled") === "true";

  const logs = await prisma.productionLog.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(includeCancelled ? {} : { status: { not: "CANCELLED" } })
    },
    include: {
      finishedSku: true,
      machine: true,
      operator: true,
      supervisor: true,
      crewAssignments: { include: { employee: true } },
      consumptions: { include: { rawSku: true, batch: true } },
      salesOrderLine: {
        include: {
          salesOrder: { include: { customer: true } },
          sku: true
        }
      }
    },
    orderBy: { startAt: "desc" }
  });

  return jsonOk(logs);
}
