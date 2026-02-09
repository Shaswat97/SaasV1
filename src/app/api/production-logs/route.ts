import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export async function GET(request: Request) {
  const companyId = await getDefaultCompanyId();
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
      consumptions: { include: { rawSku: true } },
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
