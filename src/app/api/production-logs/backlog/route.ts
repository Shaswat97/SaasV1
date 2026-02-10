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

  const backlog = lines
    .map((line) => {
      const openQty = line.quantity - line.producedQty;
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
        producedQty: line.producedQty,
        openQty
      };
    })
    .filter((line) => line.openQty > 0);

  return jsonOk(backlog);
}
