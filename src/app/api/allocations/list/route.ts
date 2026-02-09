import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const poLineId = searchParams.get("poLineId") || undefined;
  const soLineId = searchParams.get("soLineId") || undefined;

  const companyId = await getDefaultCompanyId(prisma);

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
