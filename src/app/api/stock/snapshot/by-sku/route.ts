import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await getDefaultCompanyId();

  const balances = await prisma.stockBalance.findMany({
    where: { companyId },
    include: {
      sku: true,
      zone: { include: { warehouse: true } }
    },
    orderBy: [{ skuId: "asc" }, { zoneId: "asc" }]
  });

  return jsonOk(balances);
}
