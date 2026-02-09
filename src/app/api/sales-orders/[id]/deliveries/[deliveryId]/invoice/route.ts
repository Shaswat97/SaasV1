import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { id: string; deliveryId: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const delivery = await prisma.salesOrderDelivery.findFirst({
    where: { id: params.deliveryId, companyId, salesOrderId: params.id },
    include: {
      line: true,
      salesOrder: true
    }
  });

  if (!delivery) return jsonError("Delivery not found", 404);

  const existing = await prisma.salesInvoice.findFirst({
    where: { deliveryId: delivery.id }
  });

  if (existing) return jsonError("Invoice already exists for this delivery", 400);

  const orderLine = await prisma.salesOrderLine.findFirst({
    where: { id: delivery.soLineId },
    include: { sku: true }
  });

  if (!orderLine) return jsonError("Sales order line not found", 404);

  const invoice = await prisma.salesInvoice.create({
    data: {
      companyId,
      salesOrderId: delivery.salesOrderId,
      deliveryId: delivery.id,
      currency: delivery.salesOrder.currency,
      notes: delivery.packagingCost > 0 ? `Packaging cost: ${delivery.packagingCost}` : undefined,
      lines: {
        create: [
          {
            soLineId: delivery.soLineId,
            skuId: orderLine.skuId,
            quantity: delivery.quantity,
            unitPrice: orderLine.unitPrice,
            discountPct: orderLine.discountPct ?? 0,
            taxPct: orderLine.taxPct ?? 0
          }
        ]
      }
    },
    include: { lines: true }
  });

  return jsonOk(invoice, { status: 201 });
}
