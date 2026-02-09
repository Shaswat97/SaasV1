import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const lines = await prisma.salesOrderLine.findMany({
    where: {
      salesOrder: {
        companyId,
        deletedAt: null,
        status: { in: ["QUOTE", "CONFIRMED", "PRODUCTION", "DISPATCH"] }
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
