import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function lineNetTotal(line: { quantity: number; unitPrice: number; discountPct?: number | null; taxPct?: number | null }) {
  const discount = line.discountPct ?? 0;
  const tax = line.taxPct ?? 0;
  const discounted = line.unitPrice * (1 - discount / 100);
  return line.quantity * discounted * (1 + tax / 100);
}

async function buildInvoiceNumber(
  prisma: ReturnType<typeof getTenantPrisma> extends Promise<infer T> ? T : never,
  companyId: string,
  salesOrderId: string,
  soNumber: string | null | undefined
) {
  // Count invoices already on this specific order to get sub-sequence number
  const count = await prisma!.salesInvoice.count({ where: { companyId, salesOrderId } });
  const seq = count + 1;
  const base = soNumber ?? salesOrderId.slice(-8).toUpperCase();
  return `${base}/${seq}`;
}

export async function POST(_: Request, { params }: { params: { id: string; deliveryId: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const delivery = await prisma.salesOrderDelivery.findFirst({
    where: { id: params.deliveryId, companyId, salesOrderId: params.id },
    include: {
      line: true,
      salesOrder: { include: { customer: true } }
    }
  });

  if (!delivery) return jsonError("Delivery not found", 404);
  if (!["DISPATCH", "DELIVERED", "INVOICED"].includes(delivery.salesOrder.status)) {
    return jsonError("Invoice can only be created for dispatched or delivered orders", 400);
  }
  if (!delivery.deliveryDate) {
    return jsonError("Delivery date is required before invoice creation", 400);
  }

  const existing = await prisma.salesInvoice.findFirst({
    where: { deliveryId: delivery.id }
  });

  if (existing) return jsonError("Invoice already exists for this delivery", 400);

  const orderLine = await prisma.salesOrderLine.findFirst({
    where: { id: delivery.soLineId },
    include: { sku: true }
  });

  if (!orderLine) return jsonError("Sales order line not found", 404);

  const existingInvoiceLinesForSoLine = await prisma.salesInvoiceLine.findMany({
    where: {
      soLineId: delivery.soLineId,
      invoice: {
        companyId,
        salesOrderId: delivery.salesOrderId
      }
    }
  });
  const alreadyInvoicedQty = existingInvoiceLinesForSoLine.reduce((sum, line) => sum + line.quantity, 0);
  const uninvoicedDeliveredQty = Math.max((orderLine.deliveredQty ?? 0) - alreadyInvoicedQty, 0);

  if (uninvoicedDeliveredQty <= 0) {
    return jsonError(
      "Delivered quantity for this SKU is already fully invoiced (possibly via consolidated invoice)",
      400
    );
  }
  if (delivery.quantity > uninvoicedDeliveredQty) {
    return jsonError(
      "This delivery exceeds the remaining uninvoiced quantity for the line. A consolidated invoice may already cover part/all of it.",
      400
    );
  }

  const invoiceDate = new Date();
  const creditDays = delivery.salesOrder.creditDays ?? delivery.salesOrder.customer?.creditDays ?? 0;
  const dueDate = creditDays > 0 ? new Date(invoiceDate.getTime() + creditDays * 86400000) : null;
  const invoiceNumber = await buildInvoiceNumber(
    prisma,
    companyId,
    delivery.salesOrderId,
    delivery.salesOrder.soNumber
  );
  const lineTotal = lineNetTotal({
    quantity: delivery.quantity,
    unitPrice: orderLine.unitPrice,
    discountPct: orderLine.discountPct ?? 0,
    taxPct: orderLine.taxPct ?? 0
  });
  const packagingCost = delivery.packagingCost ?? 0;
  const totalAmount = lineTotal + packagingCost;
  const balanceAmount = totalAmount;

  const invoice = await prisma.salesInvoice.create({
    data: {
      companyId,
      salesOrderId: delivery.salesOrderId,
      deliveryId: delivery.id,
      invoiceNumber,
      invoiceDate,
      dueDate: dueDate ?? undefined,
      status: balanceAmount > 0 ? "UNPAID" : "PAID",
      currency: delivery.salesOrder.currency,
      totalAmount,
      balanceAmount,
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
