import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";
import { jsonError, jsonOk } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type DrilldownMetric =
  | "orderBacklog"
  | "totalRevenue"
  | "inventoryValue"
  | "receivables"
  | "payables"
  | "avgOee"
  | "deliveryCompletion";

function parseDateRange(searchParams: URLSearchParams) {
  const today = new Date();
  const defaultTo = new Date(today);
  defaultTo.setHours(23, 59, 59, 999);
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  defaultFrom.setHours(0, 0, 0, 0);

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const parsedFrom = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom;
  const parsedTo = toParam ? new Date(`${toParam}T23:59:59.999`) : defaultTo;

  const from = Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom;
  const to = Number.isNaN(parsedTo.getTime()) ? defaultTo : parsedTo;

  if (from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

function fmtDate(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);

  const companyId = await getDefaultCompanyId(prisma);
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric") as DrilldownMetric | null;
  if (!metric) return jsonError("Missing metric", 400);

  const { from, to } = parseDateRange(searchParams);

  if (metric === "orderBacklog") {
    const lines = await prisma.salesOrderLine.findMany({
      where: {
        salesOrder: {
          companyId,
          deletedAt: null,
          status: { in: ["QUOTE", "CONFIRMED", "PRODUCTION", "DISPATCH"] },
          orderDate: { gte: from, lte: to }
        }
      },
      include: {
        salesOrder: {
          select: {
            soNumber: true,
            status: true,
            orderDate: true,
            customer: { select: { name: true } }
          }
        },
        sku: { select: { code: true, name: true, unit: true } }
      },
      orderBy: [{ salesOrder: { orderDate: "desc" } }]
    });

    const rows = lines
      .map((line) => {
        const delivered = line.deliveredQty ?? 0;
        const openQty = Math.max(line.quantity - delivered, 0);
        const openValue = openQty * line.unitPrice * (1 - (line.discountPct ?? 0) / 100) * (1 + (line.taxPct ?? 0) / 100);
        return {
          order: line.salesOrder.soNumber ?? "—",
          customer: line.salesOrder.customer?.name ?? "—",
          sku: `${line.sku.code} · ${line.sku.name}`,
          ordered: `${line.quantity} ${line.sku.unit}`,
          delivered: `${delivered} ${line.sku.unit}`,
          open: `${openQty} ${line.sku.unit}`,
          openQty,
          openValue,
          status: line.salesOrder.status
        };
      })
      .filter((row) => row.openQty > 0)
      .sort((a, b) => b.openValue - a.openValue)
      .map(({ openQty: _openQty, ...row }) => row);

    return jsonOk({
      metric,
      title: "Order Backlog Breakdown",
      description: "All open sales lines contributing to backlog value.",
      modulePath: "/sales-orders",
      columns: [
        { key: "order", label: "Order" },
        { key: "customer", label: "Customer" },
        { key: "sku", label: "SKU" },
        { key: "ordered", label: "Ordered", align: "right" },
        { key: "delivered", label: "Delivered", align: "right" },
        { key: "open", label: "Open", align: "right" },
        { key: "status", label: "Status" }
      ],
      rows,
      sourceCount: rows.length
    });
  }

  if (metric === "totalRevenue") {
    const invoices = await prisma.salesInvoice.findMany({
      where: { companyId, invoiceDate: { gte: from, lte: to } },
      include: {
        salesOrder: { select: { soNumber: true, customer: { select: { name: true } } } }
      },
      orderBy: { invoiceDate: "desc" }
    });
    const rows = invoices.map((invoice) => ({
      invoice: invoice.invoiceNumber ?? "—",
      date: fmtDate(invoice.invoiceDate),
      order: invoice.salesOrder.soNumber ?? "—",
      customer: invoice.salesOrder.customer?.name ?? "—",
      total: invoice.totalAmount ?? 0,
      balance: invoice.balanceAmount ?? 0,
      status: invoice.status
    }));

    return jsonOk({
      metric,
      title: "Revenue Breakdown",
      description: "Invoices in selected range contributing to total revenue.",
      modulePath: "/sales-orders",
      columns: [
        { key: "invoice", label: "Invoice" },
        { key: "date", label: "Date" },
        { key: "order", label: "Order" },
        { key: "customer", label: "Customer" },
        { key: "total", label: "Total", align: "right" },
        { key: "balance", label: "Balance", align: "right" },
        { key: "status", label: "Status" }
      ],
      rows,
      sourceCount: rows.length
    });
  }

  if (metric === "inventoryValue") {
    const balances = await prisma.stockBalance.findMany({
      where: { companyId, quantityOnHand: { gt: 0 } },
      include: {
        sku: { select: { code: true, name: true, unit: true } },
        zone: { select: { name: true, type: true } }
      },
      orderBy: { totalCost: "desc" }
    });

    const rows = balances.map((row) => ({
      zone: row.zone.name,
      zoneType: row.zone.type,
      sku: `${row.sku.code} · ${row.sku.name}`,
      qty: `${row.quantityOnHand} ${row.sku.unit}`,
      cp: row.costPerUnit,
      value: row.totalCost
    }));

    return jsonOk({
      metric,
      title: "Inventory Value Breakdown",
      description: "Stock balances by zone and SKU that make up current inventory value.",
      modulePath: "/inventory",
      columns: [
        { key: "zone", label: "Zone" },
        { key: "zoneType", label: "Zone Type" },
        { key: "sku", label: "SKU" },
        { key: "qty", label: "Qty", align: "right" },
        { key: "cp", label: "Cost/Unit", align: "right" },
        { key: "value", label: "Value", align: "right" }
      ],
      rows,
      sourceCount: rows.length
    });
  }

  if (metric === "receivables") {
    const invoices = await prisma.salesInvoice.findMany({
      where: { companyId, balanceAmount: { gt: 0 } },
      include: {
        salesOrder: {
          select: { soNumber: true, customer: { select: { name: true } } }
        }
      },
      orderBy: [{ dueDate: "asc" }, { invoiceDate: "desc" }]
    });
    const rows = invoices.map((invoice) => ({
      invoice: invoice.invoiceNumber ?? "—",
      order: invoice.salesOrder.soNumber ?? "—",
      customer: invoice.salesOrder.customer?.name ?? "—",
      invoiceDate: fmtDate(invoice.invoiceDate),
      dueDate: fmtDate(invoice.dueDate),
      outstanding: invoice.balanceAmount ?? 0,
      status: invoice.status
    }));

    return jsonOk({
      metric,
      title: "Receivables Breakdown",
      description: "Open customer invoices contributing to receivables outstanding.",
      modulePath: "/sales-orders",
      columns: [
        { key: "invoice", label: "Invoice" },
        { key: "order", label: "Order" },
        { key: "customer", label: "Customer" },
        { key: "invoiceDate", label: "Invoice Date" },
        { key: "dueDate", label: "Due Date" },
        { key: "outstanding", label: "Outstanding", align: "right" },
        { key: "status", label: "Status" }
      ],
      rows,
      sourceCount: rows.length
    });
  }

  if (metric === "payables") {
    const bills = await prisma.vendorBill.findMany({
      where: { companyId, balanceAmount: { gt: 0 } },
      include: {
        vendor: { select: { name: true } },
        purchaseOrder: { select: { poNumber: true } }
      },
      orderBy: [{ dueDate: "asc" }, { billDate: "desc" }]
    });
    const rows = bills.map((bill) => ({
      bill: bill.billNumber ?? "—",
      po: bill.purchaseOrder?.poNumber ?? "—",
      vendor: bill.vendor.name,
      billDate: fmtDate(bill.billDate),
      dueDate: fmtDate(bill.dueDate),
      outstanding: bill.balanceAmount ?? 0,
      status: bill.status
    }));

    return jsonOk({
      metric,
      title: "Payables Breakdown",
      description: "Open vendor bills contributing to payables outstanding.",
      modulePath: "/purchasing",
      columns: [
        { key: "bill", label: "Bill" },
        { key: "po", label: "PO" },
        { key: "vendor", label: "Vendor" },
        { key: "billDate", label: "Bill Date" },
        { key: "dueDate", label: "Due Date" },
        { key: "outstanding", label: "Outstanding", align: "right" },
        { key: "status", label: "Status" }
      ],
      rows,
      sourceCount: rows.length
    });
  }

  if (metric === "avgOee") {
    const logs = await prisma.productionLog.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "CLOSED",
        closeAt: { not: null, gte: from, lte: to }
      },
      include: {
        machine: { select: { code: true, name: true } },
        finishedSku: { select: { code: true, name: true } }
      },
      orderBy: { closeAt: "desc" }
    });

    const rows = logs.map((log) => ({
      machine: `${log.machine.code} · ${log.machine.name}`,
      sku: `${log.finishedSku.code} · ${log.finishedSku.name}`,
      start: fmtDate(log.startAt),
      close: fmtDate(log.closeAt),
      good: log.goodQty ?? 0,
      reject: log.rejectQty ?? 0,
      scrap: log.scrapQty ?? 0,
      oee: log.oeePct ?? 0
    }));

    return jsonOk({
      metric,
      title: "OEE Breakdown",
      description: "Closed production logs used to calculate average OEE.",
      modulePath: "/production",
      columns: [
        { key: "machine", label: "Machine" },
        { key: "sku", label: "SKU" },
        { key: "start", label: "Start" },
        { key: "close", label: "Close" },
        { key: "good", label: "Good", align: "right" },
        { key: "reject", label: "Reject", align: "right" },
        { key: "scrap", label: "Scrap", align: "right" },
        { key: "oee", label: "OEE %", align: "right" }
      ],
      rows,
      sourceCount: rows.length
    });
  }

  if (metric === "deliveryCompletion") {
    const lines = await prisma.salesOrderLine.findMany({
      where: {
        salesOrder: {
          companyId,
          deletedAt: null,
          status: { in: ["QUOTE", "CONFIRMED", "PRODUCTION", "DISPATCH"] },
          orderDate: { gte: from, lte: to }
        }
      },
      include: {
        salesOrder: { select: { soNumber: true, status: true, customer: { select: { name: true } } } },
        sku: { select: { code: true, name: true, unit: true } }
      },
      orderBy: [{ salesOrder: { orderDate: "desc" } }]
    });
    const rows = lines.map((line) => {
      const delivered = line.deliveredQty ?? 0;
      const openQty = Math.max(line.quantity - delivered, 0);
      const completion = line.quantity > 0 ? (delivered / line.quantity) * 100 : 0;
      return {
        order: line.salesOrder.soNumber ?? "—",
        customer: line.salesOrder.customer?.name ?? "—",
        sku: `${line.sku.code} · ${line.sku.name}`,
        ordered: `${line.quantity} ${line.sku.unit}`,
        delivered: `${delivered} ${line.sku.unit}`,
        open: `${openQty} ${line.sku.unit}`,
        completion,
        status: line.salesOrder.status
      };
    });

    return jsonOk({
      metric,
      title: "Delivery Completion Breakdown",
      description: "Line-level delivery progress used for completion percentage.",
      modulePath: "/sales-orders",
      columns: [
        { key: "order", label: "Order" },
        { key: "customer", label: "Customer" },
        { key: "sku", label: "SKU" },
        { key: "ordered", label: "Ordered", align: "right" },
        { key: "delivered", label: "Delivered", align: "right" },
        { key: "open", label: "Open", align: "right" },
        { key: "completion", label: "Completion %", align: "right" },
        { key: "status", label: "Status" }
      ],
      rows,
      sourceCount: rows.length
    });
  }

  return jsonError("Unsupported metric", 400);
}
