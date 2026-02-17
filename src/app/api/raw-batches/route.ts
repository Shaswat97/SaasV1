import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { searchParams } = new URL(request.url);
  const rawSkuId = searchParams.get("rawSkuId") || undefined;

  const rawZone = await prisma.zone.findFirst({
    where: { companyId, deletedAt: null, type: "RAW_MATERIAL" },
    select: { id: true }
  });
  if (!rawZone) return jsonError("Raw material zone not found", 404);

  const rows = await prisma.rawMaterialBatch.findMany({
    where: {
      companyId,
      zoneId: rawZone.id,
      quantityRemaining: { gt: 0 },
      ...(rawSkuId ? { skuId: rawSkuId } : {})
    },
    include: {
      sku: { select: { id: true, code: true, name: true, unit: true } }
    },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }]
  });

  return jsonOk(rows);
}

