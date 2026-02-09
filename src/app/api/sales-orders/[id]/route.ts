import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { buildProcurementPlan, computeAvailabilitySummary } from "@/lib/sales-order";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: {
      customer: true,
      lines: { include: { sku: true } },
      deliveries: { include: { line: { include: { sku: true } } } },
      invoices: { include: { lines: { include: { sku: true } }, delivery: true } }
    }
  });

  if (!order) return jsonError("Sales order not found", 404);

  const availability = await computeAvailabilitySummary({
    companyId,
    lines: order.lines.map((line) => ({
      id: line.id,
      skuId: line.skuId,
      quantity: line.quantity,
      deliveredQty: line.deliveredQty
    })),
    excludeSoLineIds: order.lines.map((line) => line.id)
  });

  const procurementPlan = await buildProcurementPlan({
    companyId,
    lines: order.lines.map((line) => ({
      id: line.id,
      skuId: line.skuId,
      quantity: line.quantity,
      deliveredQty: line.deliveredQty
    })),
    availability,
    excludeSoLineIds: order.lines.map((line) => line.id)
  });

  return jsonOk({ ...order, availability, procurementPlan });
}
