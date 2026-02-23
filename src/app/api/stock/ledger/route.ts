import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const zoneId = searchParams.get("zoneId") || undefined;
  const skuId = searchParams.get("skuId") || undefined;
  const limit = Number(searchParams.get("limit") ?? "50");

  const companyId = await getDefaultCompanyId(prisma);

  const ledger = await prisma.stockLedger.findMany({
    where: {
      companyId,
      ...(zoneId ? { zoneId } : {}),
      ...(skuId ? { skuId } : {})
    },
    include: {
      sku: true,
      zone: { include: { warehouse: true } }
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? Math.min(limit, 200) : 50
  });

  return jsonOk(ledger);
}
