import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poLineId = searchParams.get("poLineId") || undefined;
  const soLineId = searchParams.get("soLineId") || undefined;

  const companyId = await getDefaultCompanyId();

  const allocations = await prisma.purchaseOrderAllocation.findMany({
    where: {
      ...(poLineId ? { poLineId } : {}),
      ...(soLineId ? { soLineId } : {}),
      poLine: { purchaseOrder: { companyId } }
    },
    include: {
      poLine: { include: { purchaseOrder: true, sku: true } },
      soLine: { include: { salesOrder: true, sku: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(allocations);
}
