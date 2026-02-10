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
  if (!customerId || !skuId) return jsonError("customerId and skuId are required", 400);

  const invoiceLine = await prisma.salesInvoiceLine.findFirst({
    where: {
      skuId,
      invoice: {
        companyId,
        salesOrder: { customerId }
      }
    },
    include: {
      invoice: { select: { invoiceDate: true, salesOrder: { select: { soNumber: true } }, currency: true } }
    },
    orderBy: { invoice: { invoiceDate: "desc" } }
  });

  if (invoiceLine) {
    return jsonOk({
      source: "invoice",
      unitPrice: invoiceLine.unitPrice,
      currency: invoiceLine.invoice?.currency ?? "INR",
      date: invoiceLine.invoice?.invoiceDate?.toISOString() ?? null,
      soNumber: invoiceLine.invoice?.salesOrder?.soNumber ?? null
    });
  }

  const orderLine = await prisma.salesOrderLine.findFirst({
    where: {
      skuId,
      salesOrder: { companyId, customerId, deletedAt: null }
    },
    include: {
      salesOrder: { select: { orderDate: true, soNumber: true } }
    },
    orderBy: { salesOrder: { orderDate: "desc" } }
  });

  if (!orderLine) return jsonOk(null);

  return jsonOk({
    source: "order",
    unitPrice: orderLine.unitPrice,
    currency: "INR",
    date: orderLine.salesOrder?.orderDate?.toISOString() ?? null,
    soNumber: orderLine.salesOrder?.soNumber ?? null
  });
}
