import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function parseRange(searchParams: URLSearchParams) {
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  if (!fromParam || !toParam) return null;
  const from = new Date(`${fromParam}T00:00:00`);
  const to = new Date(`${toParam}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return from > to ? { from: to, to: from } : { from, to };
}

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const range = parseRange(new URL(request.url).searchParams);

  const lines = await prisma.salesOrderLine.findMany({
    where: {
      salesOrder: {
        companyId,
        deletedAt: null,
        status: { in: ["QUOTE", "CONFIRMED", "PRODUCTION", "DISPATCH"] },
        ...(range ? { orderDate: { gte: range.from, lte: range.to } } : {})
      }
    },
    include: {
      salesOrder: { include: { customer: true } },
      sku: true
    },
    orderBy: { createdAt: "desc" }
  });

  const lineIds = lines.map((line) => line.id);
  const loggedGoodByLine = new Map<string, number>();
  if (lineIds.length > 0) {
    const logAgg = await prisma.productionLog.groupBy({
      by: ["salesOrderLineId"],
      where: {
        companyId,
        deletedAt: null,
        salesOrderLineId: { in: lineIds },
        status: { not: "CANCELLED" }
      },
      _sum: { goodQty: true }
    });
    logAgg.forEach((row) => {
      if (!row.salesOrderLineId) return;
      loggedGoodByLine.set(row.salesOrderLineId, row._sum.goodQty ?? 0);
    });
  }

  const backlog = lines
    .map((line) => {
      const lineProducedQty = line.producedQty ?? 0;
      const loggedGoodQty = loggedGoodByLine.get(line.id) ?? 0;
      const effectiveProducedQty = Math.max(lineProducedQty, loggedGoodQty);
      const openQty = Math.max(line.quantity - effectiveProducedQty, 0);
      return {
        id: line.id,
        soNumber: line.salesOrder.soNumber ?? "—",
        status: line.salesOrder.status,
        customer: line.salesOrder.customer.name,
        skuId: line.skuId,
        skuCode: line.sku.code,
        skuName: line.sku.name,
        unit: line.sku.unit,
        orderedQty: line.quantity,
        producedQty: effectiveProducedQty,
        lineProducedQty,
        loggedGoodQty,
        openQty
      };
    })
    .filter((line) => line.openQty > 0);

  return jsonOk(backlog);
}
