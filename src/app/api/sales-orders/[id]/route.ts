import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { buildProcurementPlan, computeAvailabilitySummary } from "@/lib/sales-order";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  let order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: {
      customer: true,
      lines: { include: { sku: true } },
      deliveries: { include: { line: { include: { sku: true } } } },
      invoices: { include: { lines: { include: { sku: true } }, delivery: true, payments: { include: { payment: true } } } }
    }
  });

  if (!order) return jsonError("Sales order not found", 404);
  if (order.status === "DISPATCH" && order.deliveries.length > 0) {
    const allDelivered = order.lines.every((line) => (line.deliveredQty ?? 0) >= line.quantity);
    if (allDelivered) {
      order = await prisma.salesOrder.update({
        where: { id: order.id },
        data: { status: "DELIVERED" },
        include: {
          customer: true,
          lines: { include: { sku: true } },
          deliveries: { include: { line: { include: { sku: true } } } },
          invoices: { include: { lines: { include: { sku: true } }, delivery: true, payments: { include: { payment: true } } } }
        }
      });
    }
  }

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
