import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { computeEmployeePerformance } from "@/lib/employee-performance";

export const dynamic = "force-dynamic";

const SHIFT_HOURS = 8;

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

  if (from > to) return { from: to, to: from };
  return { from, to };
}

function lineNetTotal(line: { quantity: number; unitPrice: number; discountPct?: number | null; taxPct?: number | null }) {
  const discount = line.discountPct ?? 0;
  const tax = line.taxPct ?? 0;
  const discounted = line.unitPrice * (1 - discount / 100);
  return line.quantity * discounted * (1 + tax / 100);
}

function computeAgingBucket(days: number) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const url = new URL(request.url);
  const { from, to } = parseDateRange(url.searchParams);
  const now = new Date();
  const rangeDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
  const availableMinutes = rangeDays * SHIFT_HOURS * 60;

  const [
    stockBalances,
    stockLedgers,
    salesOrders,
    salesInvoices,
    salesInvoiceLines,
    salesPayments,
    purchaseOrders,
    goodsReceipts,
    vendorBills,
    vendorPayments,
    productionLogs,
    productionCostLogs,
    employeePerf
  ] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { companyId },
      include: { sku: true, zone: true }
    }),
    prisma.stockLedger.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { skuId: true, createdAt: true }
    }),
    prisma.salesOrder.findMany({
      where: { companyId, deletedAt: null, orderDate: { gte: from, lte: to } },
      include: { customer: true, lines: true }
    }),
    prisma.salesInvoice.findMany({
      where: { companyId, invoiceDate: { gte: from, lte: to } },
      include: {
        salesOrder: { include: { customer: true } },
        lines: true,
        payments: true
      }
    }),
    prisma.salesInvoiceLine.findMany({
      where: {
        invoice: {
          companyId,
          invoiceDate: { gte: from, lte: to }
        }
      },
      include: {
        sku: { select: { id: true, code: true, name: true, unit: true } },
        soLine: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            discountPct: true,
            taxPct: true,
            expectedRawCost: true,
            actualRawCost: true,
            salesOrderId: true,
            salesOrder: {
              select: {
                id: true,
                soNumber: true,
                status: true,
                customer: { select: { name: true } }
              }
            }
          }
        }
      }
    }),
    prisma.salesPayment.findMany({
      where: { companyId, paymentDate: { gte: from, lte: to } }
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId, deletedAt: null, orderDate: { gte: from, lte: to } },
      include: { vendor: true, lines: true }
    }),
    prisma.goodsReceipt.findMany({
      where: { companyId, receivedAt: { gte: from, lte: to } },
      include: { purchaseOrder: true, vendor: true, lines: true }
    }),
    prisma.vendorBill.findMany({
      where: { companyId, billDate: { gte: from, lte: to } },
      include: { vendor: true, payments: true, lines: true }
    }),
    prisma.vendorPayment.findMany({
      where: { companyId, paymentDate: { gte: from, lte: to } }
    }),
    prisma.productionLog.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "CLOSED",
        closeAt: { not: null, gte: from, lte: to }
      },
      include: { machine: true, finishedSku: true }
    }),
    prisma.productionLog.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "CLOSED",
        salesOrderLineId: { not: null }
      },
      select: {
        salesOrderLineId: true,
        laborCost: true,
        machineOverheadCost: true,
        conversionCost: true
      }
    }),
    computeEmployeePerformance({ companyId, from, to, tx: prisma })
  ]);

  const inventoryValue = stockBalances.reduce((sum, balance) => sum + balance.totalCost, 0);
  const totalRevenue = salesInvoiceLines.reduce((sum, line) => sum + lineNetTotal(line), 0);
  const totalReceivable = salesInvoices.reduce((sum, invoice) => sum + Math.max(invoice.balanceAmount ?? 0, 0), 0);
  const totalPayable = vendorBills.reduce((sum, bill) => sum + Math.max(bill.balanceAmount ?? 0, 0), 0);

  const conversionCostBySoLine = new Map<string, number>();
  const laborCostBySoLine = new Map<string, number>();
  const overheadCostBySoLine = new Map<string, number>();
  productionCostLogs
    .filter((log) => Boolean(log.salesOrderLineId))
    .forEach((log) => {
      const soLineId = log.salesOrderLineId as string;
      const labor = log.laborCost ?? 0;
      const overhead = log.machineOverheadCost ?? 0;
      const conversion = log.conversionCost ?? (log.laborCost ?? 0) + (log.machineOverheadCost ?? 0);
      if (labor) laborCostBySoLine.set(soLineId, (laborCostBySoLine.get(soLineId) ?? 0) + labor);
      if (overhead) overheadCostBySoLine.set(soLineId, (overheadCostBySoLine.get(soLineId) ?? 0) + overhead);
      if (conversion) conversionCostBySoLine.set(soLineId, (conversionCostBySoLine.get(soLineId) ?? 0) + conversion);
    });

  const salesByCustomerMap = new Map<string, { customerId: string; customer: string; value: number; qty: number }>();
  salesOrders.forEach((order) => {
    const current = salesByCustomerMap.get(order.customerId) ?? {
      customerId: order.customerId,
      customer: order.customer?.name ?? "Unknown",
      value: 0,
      qty: 0
    };
    order.lines.forEach((line) => {
      current.value += lineNetTotal(line);
      current.qty += line.quantity;
    });
    salesByCustomerMap.set(order.customerId, current);
  });
  const salesByCustomer = Array.from(salesByCustomerMap.values()).sort((a, b) => b.value - a.value);

  const salesBySkuMap = new Map<
    string,
    { skuId: string; code: string; name: string; unit: string; qty: number; revenue: number; expectedCost: number; actualCost: number }
  >();
  salesInvoiceLines.forEach((line) => {
    const current = salesBySkuMap.get(line.skuId) ?? {
      skuId: line.skuId,
      code: line.sku.code,
      name: line.sku.name,
      unit: line.sku.unit,
      qty: 0,
      revenue: 0,
      expectedCost: 0,
      actualCost: 0
    };
    current.qty += line.quantity;
    current.revenue += lineNetTotal(line);
    const ratio = line.soLine.quantity > 0 ? line.quantity / line.soLine.quantity : 0;
    current.expectedCost += (line.soLine.expectedRawCost ?? 0) * ratio;
    const actualRawCost = line.soLine.actualRawCost ?? 0;
    const conversionCost = conversionCostBySoLine.get(line.soLineId) ?? 0;
    current.actualCost += (actualRawCost + conversionCost) * ratio;
    salesBySkuMap.set(line.skuId, current);
  });
  const salesBySku = Array.from(salesBySkuMap.values())
    .map((row) => {
      const baseCost = row.actualCost > 0 ? row.actualCost : row.expectedCost;
      const margin = row.revenue - baseCost;
      return {
        ...row,
        margin,
        marginPct: row.revenue > 0 ? (margin / row.revenue) * 100 : 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const orderProfitability = salesOrders
    .map((order) => {
      const revenue = order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0);
      const expectedCost = order.lines.reduce((sum, line) => sum + (line.expectedRawCost ?? 0), 0);
      const actualRawCost = order.lines.reduce((sum, line) => sum + (line.actualRawCost ?? 0), 0);
      const actualConversionCost = order.lines.reduce((sum, line) => sum + (conversionCostBySoLine.get(line.id) ?? 0), 0);
      const actualCost = actualRawCost + actualConversionCost;
      const baseCost = actualCost > 0 ? actualCost : expectedCost;
      const margin = revenue - baseCost;
      return {
        salesOrderId: order.id,
        soNumber: order.soNumber ?? "—",
        customer: order.customer?.name ?? "Unknown",
        status: order.status,
        revenue,
        expectedCost,
        actualRawCost,
        actualConversionCost,
        actualCost,
        margin,
        marginPct: revenue > 0 ? (margin / revenue) * 100 : 0
      };
    })
    .sort((a, b) => b.margin - a.margin);

  const orderLineProfitabilityMap = new Map<
    string,
    {
      salesOrderId: string;
      soLineId: string;
      soNumber: string;
      customer: string;
      orderStatus: string;
      skuId: string;
      skuCode: string;
      skuName: string;
      unit: string;
      qty: number;
      revenueExTax: number;
      revenueIncTax: number;
      rawCost: number;
      laborCost: number;
      overheadCost: number;
      finalMfgCost: number;
    }
  >();

  salesInvoiceLines.forEach((line) => {
    const soLine = line.soLine;
    const soLineQty = soLine.quantity > 0 ? soLine.quantity : 0;
    const ratio = soLineQty > 0 ? line.quantity / soLineQty : 0;
    const netUnit = line.unitPrice * (1 - (line.discountPct ?? 0) / 100);
    const revenueExTax = line.quantity * netUnit;
    const revenueIncTax = line.quantity * netUnit * (1 + (line.taxPct ?? 0) / 100);
    const rawCost = (soLine.actualRawCost ?? 0) * ratio;
    const laborCost = (laborCostBySoLine.get(line.soLineId) ?? 0) * ratio;
    const overheadCost = (overheadCostBySoLine.get(line.soLineId) ?? 0) * ratio;
    const finalMfgCost = rawCost + laborCost + overheadCost;

    const key = `${line.soLineId}`;
    const current = orderLineProfitabilityMap.get(key) ?? {
      salesOrderId: soLine.salesOrderId,
      soLineId: line.soLineId,
      soNumber: soLine.salesOrder?.soNumber ?? "—",
      customer: soLine.salesOrder?.customer?.name ?? "Unknown",
      orderStatus: soLine.salesOrder?.status ?? "UNKNOWN",
      skuId: line.skuId,
      skuCode: line.sku.code,
      skuName: line.sku.name,
      unit: line.sku.unit,
      qty: 0,
      revenueExTax: 0,
      revenueIncTax: 0,
      rawCost: 0,
      laborCost: 0,
      overheadCost: 0,
      finalMfgCost: 0
    };
    current.qty += line.quantity;
    current.revenueExTax += revenueExTax;
    current.revenueIncTax += revenueIncTax;
    current.rawCost += rawCost;
    current.laborCost += laborCost;
    current.overheadCost += overheadCost;
    current.finalMfgCost += finalMfgCost;
    orderLineProfitabilityMap.set(key, current);
  });

  const orderLineProfitability = Array.from(orderLineProfitabilityMap.values())
    .map((row) => {
      const spPerUnit = row.qty > 0 ? row.revenueExTax / row.qty : 0;
      const cpPerUnit = row.qty > 0 ? row.finalMfgCost / row.qty : 0;
      const margin = row.revenueExTax - row.finalMfgCost;
      return {
        ...row,
        spPerUnit,
        cpPerUnit,
        margin,
        marginPct: row.revenueExTax > 0 ? (margin / row.revenueExTax) * 100 : 0
      };
    })
    .sort((a, b) => b.margin - a.margin);

  const productionSummary = productionLogs.reduce(
    (acc, log) => {
      acc.planned += log.plannedQty ?? 0;
      acc.good += log.goodQty ?? 0;
      acc.reject += log.rejectQty ?? 0;
      acc.scrap += log.scrapQty ?? 0;
      return acc;
    },
    { planned: 0, good: 0, reject: 0, scrap: 0 }
  );

  const machineEfficiencyMap = new Map<
    string,
    {
      machineId: string;
      machine: string;
      runtimeMinutes: number;
      plannedQty: number;
      goodQty: number;
      rejectQty: number;
      scrapQty: number;
      oeeSum: number;
      runs: number;
      expectedRawCost: number;
      actualRawCost: number;
    }
  >();
  productionLogs.forEach((log) => {
    const current = machineEfficiencyMap.get(log.machineId) ?? {
      machineId: log.machineId,
      machine: `${log.machine.code} · ${log.machine.name}`,
      runtimeMinutes: 0,
      plannedQty: 0,
      goodQty: 0,
      rejectQty: 0,
      scrapQty: 0,
      oeeSum: 0,
      runs: 0,
      expectedRawCost: 0,
      actualRawCost: 0
    };
    const runMinutes = log.closeAt && log.startAt ? Math.max(0, (log.closeAt.getTime() - log.startAt.getTime()) / 60000) : 0;
    current.runtimeMinutes += runMinutes;
    current.plannedQty += log.plannedQty ?? 0;
    current.goodQty += log.goodQty ?? 0;
    current.rejectQty += log.rejectQty ?? 0;
    current.scrapQty += log.scrapQty ?? 0;
    current.oeeSum += log.oeePct ?? 0;
    current.runs += 1;
    current.expectedRawCost += log.expectedRawCost ?? 0;
    current.actualRawCost += log.actualRawCost ?? (log.expectedRawCost ?? 0);
    machineEfficiencyMap.set(log.machineId, current);
  });
  const machineEfficiency = Array.from(machineEfficiencyMap.values())
    .map((row) => ({
      ...row,
      utilizationPct: availableMinutes > 0 ? (row.runtimeMinutes / availableMinutes) * 100 : 0,
      avgOee: row.runs > 0 ? row.oeeSum / row.runs : 0,
      yieldPct:
        row.goodQty + row.rejectQty + row.scrapQty > 0
          ? (row.goodQty / (row.goodQty + row.rejectQty + row.scrapQty)) * 100
          : 0,
      materialVariancePct:
        row.expectedRawCost > 0 ? ((row.actualRawCost - row.expectedRawCost) / row.expectedRawCost) * 100 : 0
    }))
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const productionBySkuMap = new Map<
    string,
    { skuId: string; code: string; name: string; planned: number; good: number; reject: number; scrap: number }
  >();
  productionLogs.forEach((log) => {
    const current = productionBySkuMap.get(log.finishedSkuId) ?? {
      skuId: log.finishedSkuId,
      code: log.finishedSku.code,
      name: log.finishedSku.name,
      planned: 0,
      good: 0,
      reject: 0,
      scrap: 0
    };
    current.planned += log.plannedQty ?? 0;
    current.good += log.goodQty ?? 0;
    current.reject += log.rejectQty ?? 0;
    current.scrap += log.scrapQty ?? 0;
    productionBySkuMap.set(log.finishedSkuId, current);
  });
  const productionBySku = Array.from(productionBySkuMap.values())
    .map((row) => ({
      ...row,
      yieldPct: row.good + row.reject + row.scrap > 0 ? (row.good / (row.good + row.reject + row.scrap)) * 100 : 0
    }))
    .sort((a, b) => b.good - a.good);

  const vendorSummaryMap = new Map<
    string,
    {
      vendorId: string;
      vendor: string;
      totalValue: number;
      draft: number;
      pending: number;
      approved: number;
      received: number;
      cancelled: number;
      onTimeCount: number;
      receiptCount: number;
    }
  >();
  const poExpectedDateMap = new Map<string, Date>();
  purchaseOrders.forEach((order) => {
    const current = vendorSummaryMap.get(order.vendorId) ?? {
      vendorId: order.vendorId,
      vendor: order.vendor?.name ?? "Unknown",
      totalValue: 0,
      draft: 0,
      pending: 0,
      approved: 0,
      received: 0,
      cancelled: 0,
      onTimeCount: 0,
      receiptCount: 0
    };
    const value = order.lines.reduce((sum, line) => sum + lineNetTotal(line), 0);
    current.totalValue += value;
    if (order.status === "DRAFT") current.draft += 1;
    if (order.status === "PENDING") current.pending += 1;
    if (order.status === "APPROVED") current.approved += 1;
    if (order.status === "RECEIVED") current.received += 1;
    if (order.status === "CANCELLED") current.cancelled += 1;
    vendorSummaryMap.set(order.vendorId, current);
    const expectedDates = order.lines
      .map((line) => line.expectedDate)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime());
    poExpectedDateMap.set(order.id, expectedDates[0] ?? order.orderDate);
  });
  goodsReceipts.forEach((receipt) => {
    const entry = vendorSummaryMap.get(receipt.vendorId);
    if (!entry) return;
    entry.receiptCount += 1;
    const expected = poExpectedDateMap.get(receipt.purchaseOrderId) ?? receipt.purchaseOrder?.orderDate;
    if (expected && receipt.receivedAt <= expected) {
      entry.onTimeCount += 1;
    }
  });
  const vendorSummary = Array.from(vendorSummaryMap.values())
    .map((item) => ({
      ...item,
      onTimePct: item.receiptCount > 0 ? (item.onTimeCount / item.receiptCount) * 100 : 0
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  const receivableAgingMap = new Map<string, number>();
  salesInvoices
    .filter((invoice) => (invoice.balanceAmount ?? 0) > 0 && invoice.dueDate)
    .forEach((invoice) => {
      const days = Math.max(0, Math.floor((now.getTime() - (invoice.dueDate as Date).getTime()) / 86400000));
      const bucket = computeAgingBucket(days);
      receivableAgingMap.set(bucket, (receivableAgingMap.get(bucket) ?? 0) + (invoice.balanceAmount ?? 0));
    });

  const payableAgingMap = new Map<string, number>();
  vendorBills
    .filter((bill) => (bill.balanceAmount ?? 0) > 0 && bill.dueDate)
    .forEach((bill) => {
      const days = Math.max(0, Math.floor((now.getTime() - (bill.dueDate as Date).getTime()) / 86400000));
      const bucket = computeAgingBucket(days);
      payableAgingMap.set(bucket, (payableAgingMap.get(bucket) ?? 0) + (bill.balanceAmount ?? 0));
    });

  const lastMovementMap = new Map<string, Date>();
  stockLedgers.forEach((ledger) => {
    if (!lastMovementMap.has(ledger.skuId)) {
      lastMovementMap.set(ledger.skuId, ledger.createdAt);
    }
  });
  const inventoryBySkuMap = new Map<
    string,
    { skuId: string; code: string; name: string; skuType: string; onHand: number; value: number; lastMovementAt: Date | null }
  >();
  stockBalances.forEach((balance) => {
    const current = inventoryBySkuMap.get(balance.skuId) ?? {
      skuId: balance.skuId,
      code: balance.sku.code,
      name: balance.sku.name,
      skuType: balance.sku.type,
      onHand: 0,
      value: 0,
      lastMovementAt: lastMovementMap.get(balance.skuId) ?? null
    };
    current.onHand += balance.quantityOnHand;
    current.value += balance.totalCost;
    inventoryBySkuMap.set(balance.skuId, current);
  });
  const inventoryBySku = Array.from(inventoryBySkuMap.values())
    .map((row) => ({
      ...row,
      daysSinceMovement: row.lastMovementAt ? Math.floor((now.getTime() - row.lastMovementAt.getTime()) / 86400000) : null
    }))
    .sort((a, b) => b.value - a.value);

  const inventoryAging = [
    { bucket: "0-30", value: 0 },
    { bucket: "31-60", value: 0 },
    { bucket: "61-90", value: 0 },
    { bucket: "90+", value: 0 }
  ];
  inventoryBySku.forEach((row) => {
    const days = row.daysSinceMovement ?? 999;
    const bucket = computeAgingBucket(days);
    const target = inventoryAging.find((item) => item.bucket === bucket);
    if (target) target.value += row.value;
  });

  return jsonOk({
    range: {
      from: from.toISOString(),
      to: to.toISOString()
    },
    overview: {
      inventoryValue,
      totalRevenue,
      totalReceivable,
      totalPayable,
      avgOee:
        productionLogs.length > 0 ? productionLogs.reduce((sum, log) => sum + (log.oeePct ?? 0), 0) / productionLogs.length : 0
    },
    sales: {
      byCustomer: salesByCustomer,
      bySku: salesBySku,
      orderProfitability,
      orderLineProfitability
    },
    production: {
      summary: {
        ...productionSummary,
        yieldPct:
          productionSummary.good + productionSummary.reject + productionSummary.scrap > 0
            ? (productionSummary.good / (productionSummary.good + productionSummary.reject + productionSummary.scrap)) *
              100
            : 0
      },
      byMachine: machineEfficiency,
      bySku: productionBySku
    },
    inventory: {
      bySku: inventoryBySku,
      aging: inventoryAging
    },
    procurement: {
      vendorSummary
    },
    finance: {
      receivablesAging: ["0-30", "31-60", "61-90", "90+"].map((bucket) => ({
        bucket,
        amount: receivableAgingMap.get(bucket) ?? 0
      })),
      payablesAging: ["0-30", "31-60", "61-90", "90+"].map((bucket) => ({
        bucket,
        amount: payableAgingMap.get(bucket) ?? 0
      })),
      collectionsInRange: salesPayments.reduce((sum, payment) => sum + payment.amount, 0),
      vendorPaymentsInRange: vendorPayments.reduce((sum, payment) => sum + payment.amount, 0)
    },
    employeePerformance: {
      summary: employeePerf.summary,
      daily: employeePerf.daily
    }
  });
}
