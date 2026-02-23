import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const skuId = url.searchParams.get("skuId");
  const onDate = url.searchParams.get("date");
  const qty = Number(url.searchParams.get("qty") || "0");
  if (!customerId || !skuId) return jsonError("customerId and skuId are required", 400);
  const effectiveAt = onDate ? new Date(`${onDate}T12:00:00`) : new Date();
  if (Number.isNaN(effectiveAt.getTime())) return jsonError("Invalid date", 400);

  const candidates = await prisma.salesPriceListLine.findMany({
    where: {
      companyId,
      active: true,
      skuId,
      priceList: {
        companyId,
        customerId,
        active: true,
        deletedAt: null
      },
      effectiveFrom: { lte: effectiveAt },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }] },
        { OR: qty > 0 ? [{ minQty: null }, { minQty: { lte: qty } }] : [{ minQty: null }, { minQty: { lte: 0 } }] }
      ]
    },
    include: {
      priceList: { select: { id: true, code: true, name: true } }
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }]
  });

  const line = [...candidates].sort((a, b) => {
    const aMin = a.minQty ?? Number.NEGATIVE_INFINITY;
    const bMin = b.minQty ?? Number.NEGATIVE_INFINITY;
    if (aMin !== bMin) return bMin - aMin;
    const aFrom = new Date(a.effectiveFrom).getTime();
    const bFrom = new Date(b.effectiveFrom).getTime();
    if (aFrom !== bFrom) return bFrom - aFrom;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];

  if (!line) return jsonOk(null);

  return jsonOk({
    source: "price_list",
    unitPrice: line.unitPrice,
    discountPct: line.discountPct ?? 0,
    taxPct: line.taxPct ?? 0,
    minQty: line.minQty ?? null,
    effectiveFrom: line.effectiveFrom.toISOString(),
    effectiveTo: line.effectiveTo?.toISOString() ?? null,
    priceList: line.priceList
  });
}
