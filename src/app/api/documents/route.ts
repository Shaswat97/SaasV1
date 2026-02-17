import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type DocumentType = "SALES_INVOICE" | "GOODS_RECEIPT" | "SALES_ORDER" | "PURCHASE_ORDER" | "VENDOR_BILL";

type DocumentRow = {
  id: string;
  type: DocumentType;
  number: string;
  party: string;
  amount: number;
  date: string;
  status: string;
  pdfUrl: string;
};

function inRange(date: Date, from: Date | null, to: Date | null) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "reports.view");
  if (guard.error) return guard.error;
  const prisma = guard.prisma ?? (await getTenantPrisma());
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { searchParams } = new URL(request.url);
  const typeFilter = (searchParams.get("type") || "ALL").toUpperCase();
  const from = searchParams.get("from") ? new Date(searchParams.get("from") as string) : null;
  const to = searchParams.get("to") ? new Date(searchParams.get("to") as string) : null;
  const search = (searchParams.get("search") || "").toLowerCase().trim();

  const [invoices, receipts, salesOrders, purchaseOrders, vendorBills] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { companyId },
      include: { salesOrder: { include: { customer: true } }, lines: true },
      orderBy: { invoiceDate: "desc" },
      take: 400
    }),
    prisma.goodsReceipt.findMany({
      where: { companyId },
      include: { vendor: true, lines: true },
      orderBy: { receivedAt: "desc" },
      take: 400
    }),
    prisma.salesOrder.findMany({
      where: { companyId, deletedAt: null },
      include: { customer: true, lines: true },
      orderBy: { orderDate: "desc" },
      take: 400
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId, deletedAt: null },
      include: { vendor: true, lines: true },
      orderBy: { orderDate: "desc" },
      take: 400
    }),
    prisma.vendorBill.findMany({
      where: { companyId },
      include: { vendor: true, lines: true },
      orderBy: { billDate: "desc" },
      take: 400
    })
  ]);

  const docs: DocumentRow[] = [];

  invoices.forEach((row) => {
    const date = row.invoiceDate;
    const total = row.totalAmount > 0 ? row.totalAmount : row.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    docs.push({
      id: row.id,
      type: "SALES_INVOICE",
      number: row.invoiceNumber ?? row.id,
      party: row.salesOrder.customer.name,
      amount: total,
      date: date.toISOString(),
      status: row.status,
      pdfUrl: `/api/sales-orders/invoices/${row.id}/pdf`
    });
  });

  receipts.forEach((row) => {
    docs.push({
      id: row.id,
      type: "GOODS_RECEIPT",
      number: row.id,
      party: row.vendor.name,
      amount: row.lines.reduce((sum, line) => sum + line.totalCost, 0),
      date: row.receivedAt.toISOString(),
      status: "POSTED",
      pdfUrl: `/api/goods-receipts/${row.id}/pdf`
    });
  });

  salesOrders.forEach((row) => {
    docs.push({
      id: row.id,
      type: "SALES_ORDER",
      number: row.soNumber ?? row.id,
      party: row.customer.name,
      amount: row.lines.reduce((sum, line) => {
        const discount = line.discountPct ?? 0;
        const tax = line.taxPct ?? 0;
        const lineSubtotal = line.quantity * line.unitPrice * (1 - discount / 100);
        return sum + lineSubtotal * (1 + tax / 100);
      }, 0),
      date: row.orderDate.toISOString(),
      status: row.status,
      pdfUrl: `/api/sales-orders/${row.id}/pdf`
    });
  });

  purchaseOrders.forEach((row) => {
    docs.push({
      id: row.id,
      type: "PURCHASE_ORDER",
      number: row.poNumber ?? row.id,
      party: row.vendor.name,
      amount: row.lines.reduce((sum, line) => {
        const discount = line.discountPct ?? 0;
        const tax = line.taxPct ?? 0;
        const lineSubtotal = line.quantity * line.unitPrice * (1 - discount / 100);
        return sum + lineSubtotal * (1 + tax / 100);
      }, 0),
      date: row.orderDate.toISOString(),
      status: row.status,
      pdfUrl: `/api/purchase-orders/${row.id}/pdf`
    });
  });

  vendorBills.forEach((row) => {
    docs.push({
      id: row.id,
      type: "VENDOR_BILL",
      number: row.billNumber ?? row.id,
      party: row.vendor.name,
      amount: row.totalAmount > 0 ? row.totalAmount : row.lines.reduce((sum, line) => sum + line.totalCost, 0),
      date: row.billDate.toISOString(),
      status: row.status,
      pdfUrl: `/api/vendor-bills/${row.id}/pdf`
    });
  });

  const filtered = docs
    .filter((doc) => (typeFilter === "ALL" ? true : doc.type === typeFilter))
    .filter((doc) => inRange(new Date(doc.date), from, to))
    .filter((doc) =>
      search
        ? doc.number.toLowerCase().includes(search) ||
          doc.party.toLowerCase().includes(search) ||
          doc.type.toLowerCase().includes(search)
        : true
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return jsonOk(filtered);
}
