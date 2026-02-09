import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await getDefaultCompanyId();

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
