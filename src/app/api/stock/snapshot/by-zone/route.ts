import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const balances = await prisma.stockBalance.findMany({
    where: { companyId },
    include: {
      zone: { include: { warehouse: true } },
      sku: true
    },
    orderBy: [{ zoneId: "asc" }, { skuId: "asc" }]
  });

  return jsonOk(balances);
}
