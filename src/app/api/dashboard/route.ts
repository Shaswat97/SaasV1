import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { computeEmployeePerformance } from "@/lib/employee-performance";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 5;
const DELAY_DAYS = 7;
const DOWNTIME_HOURS = 48;
const CAPACITY_WINDOW_DAYS = 7;
const SHIFT_HOURS = 8;
const DEAD_STOCK_DAYS = 90;
const SLOW_MOVING_DAYS = 30;
const BATCH_AGING_DAYS = 30;
const HIGH_REJECT_ALERT_PCT = 10;
const SCRAP_SPIKE_ALERT_DELTA_PCT = 5;

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

function dateDiffMinutes(start: Date | null, end: Date | null) {
  if (!start || !end) return 0;
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return 0;
  return diff / 60000;
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
  const delayCutoff = new Date(now.getTime() - DELAY_DAYS * 24 * 60 * 60 * 1000);
  const downtimeCutoff = new Date(now.getTime() - DOWNTIME_HOURS * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + CAPACITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rangeDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
  const availableMinutesInRange = rangeDays * SHIFT_HOURS * 60;
  const availableMinutesCapacity = CAPACITY_WINDOW_DAYS * SHIFT_HOURS * 60;
  const rangeWindowMs = rangeDays * 86400000;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - rangeWindowMs + 1);

  const [
    salesLines,
    stockBalances,
    productionLogs,
    previousProductionLogs,
    machines,
    employeePerf,
    skus,
    invoiceLines,
    salesInvoices,
    salesPayments,
    vendorBills,
    vendorPayments,
    scrapSales,
    stockLedgerInRange,
    lastMovementBySku,
    rawBatchRows
  ] = await Promise.all([
    prisma.salesOrderLine.findMany({
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
          select: { id: true, soNumber: true, orderDate: true, status: true, customer: { select: { name: true } } }
        },
        sku: { select: { code: true, name: true, unit: true } }
      }
    }),
    prisma.stockBalance.findMany({
      where: { companyId },
      include: { sku: true, zone: true }
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
        closeAt: { not: null, gte: previousFrom, lte: previousTo }
      },
      include: { finishedSku: true }
    }),
    prisma.machine.findMany({
      where: { companyId, deletedAt: null }
    }),
    computeEmployeePerformance({ companyId, from, to, tx: prisma }),
    prisma.sku.findMany({
      where: { companyId, deletedAt: null, type: { in: ["RAW", "FINISHED"] } },
      select: { id: true, code: true, name: true, unit: true, type: true, lowStockThreshold: true }
    }),
    prisma.salesInvoiceLine.findMany({
      where: {
        invoice: {
          companyId,
          invoiceDate: { gte: from, lte: to }
        }
      },
      include: {
        sku: { select: { id: true, code: true, name: true, manufacturingCost: true } },
        soLine: { select: { quantity: true, expectedRawCost: true, actualRawCost: true } }
      }
    }),
    prisma.salesInvoice.findMany({
      where: { companyId },
      include: { salesOrder: { select: { customer: { select: { name: true } }, soNumber: true } } }
    }),
    prisma.salesPayment.findMany({
      where: { companyId, paymentDate: { gte: from, lte: to } }
    }),
    prisma.vendorBill.findMany({
      where: { companyId },
      include: { vendor: { select: { name: true } } }
    }),
    prisma.vendorPayment.findMany({
      where: { companyId, paymentDate: { gte: from, lte: to } }
    }),
    prisma.scrapSale.findMany({
      where: { companyId, saleDate: { gte: from, lte: to } },
      include: {
        lines: { include: { sku: { select: { id: true, code: true, name: true } } } }
      }
    }),
    prisma.stockLedger.findMany({
      where: { companyId, createdAt: { gte: from, lte: to } },
      include: {
        sku: { select: { id: true, code: true, name: true, type: true } },
        zone: { select: { type: true } }
      }
    }),
    prisma.stockLedger.groupBy({
      by: ["skuId"],
      where: { companyId },
      _max: { createdAt: true }
    }),
    prisma.rawMaterialBatch.findMany({
      where: { companyId, quantityRemaining: { gt: 0 } },
      include: { sku: { select: { id: true, code: true, name: true, unit: true } } },
      orderBy: { receivedAt: "asc" }
    })
  ]);

  const openLines = salesLines.map((line) => {
    const delivered = line.deliveredQty ?? 0;
    const openQty = Math.max(line.quantity - delivered, 0);
    return { ...line, openQty };
  });

  const orderBacklogValue = openLines.reduce((sum, line) => {
    const discount = line.discountPct ?? 0;
    const tax = line.taxPct ?? 0;
    const discounted = line.unitPrice * (1 - discount / 100);
    return sum + line.openQty * discounted * (1 + tax / 100);
  }, 0);

  const totalOrdered = openLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalDelivered = openLines.reduce((sum, line) => sum + (line.deliveredQty ?? 0), 0);
  const deliveryCompletionPct = totalOrdered > 0 ? (totalDelivered / totalOrdered) * 100 : 0;

  const inventoryValue = stockBalances.reduce((sum, balance) => sum + balance.totalCost, 0);

  const avgOee = productionLogs.length
    ? productionLogs.reduce((sum, log) => sum + (log.oeePct ?? 0), 0) / productionLogs.length
    : 0;

  const totalRevenue = invoiceLines.reduce((sum, line) => sum + lineNetTotal(line), 0);

  const onHandMap = new Map<string, number>();
  stockBalances.forEach((balance) => {
    if (balance.sku.type === "RAW" && balance.zone.type === "RAW_MATERIAL") {
      onHandMap.set(balance.skuId, (onHandMap.get(balance.skuId) ?? 0) + balance.quantityOnHand);
    }
    if (balance.sku.type === "FINISHED" && balance.zone.type === "FINISHED") {
      onHandMap.set(balance.skuId, (onHandMap.get(balance.skuId) ?? 0) + balance.quantityOnHand);
    }
  });

  const lowStock = skus
    .map((sku) => {
      const onHand = onHandMap.get(sku.id) ?? 0;
      const threshold = sku.lowStockThreshold ?? (sku.type === "RAW" ? LOW_STOCK_THRESHOLD : null);
      if (threshold == null) return null;
      return {
        skuId: sku.id,
        code: sku.code,
        name: sku.name,
        unit: sku.unit,
        skuType: sku.type,
        onHand,
        threshold,
        shortage: Math.max(threshold - onHand, 0),
        fixPath: "/inventory"
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.onHand <= item.threshold)
    .sort((a, b) => a.onHand - b.onHand)
    .slice(0, 8);

  const delayedDeliveries = openLines
    .filter((line) => line.openQty > 0 && line.salesOrder.orderDate < delayCutoff)
    .map((line) => {
      const daysOpen = Math.floor((now.getTime() - line.salesOrder.orderDate.getTime()) / (24 * 60 * 60 * 1000));
      return {
        soNumber: line.salesOrder.soNumber ?? "—",
        customer: line.salesOrder.customer?.name ?? "—",
        sku: `${line.sku.code} · ${line.sku.name}`,
        openQty: line.openQty,
        unit: line.sku.unit,
        daysOpen,
        fixPath: "/sales-orders"
      };
    })
    .sort((a, b) => b.daysOpen - a.daysOpen)
    .slice(0, 8);

  const machineUtilMap = new Map<
    string,
    {
      machineId: string;
      code: string;
      name: string;
      runtimeMinutes: number;
      goodQty: number;
      rejectQty: number;
      scrapQty: number;
      oeeTotal: number;
      runs: number;
    }
  >();
  machines.forEach((machine) => {
    machineUtilMap.set(machine.id, {
      machineId: machine.id,
      code: machine.code,
      name: machine.name,
      runtimeMinutes: 0,
      goodQty: 0,
      rejectQty: 0,
      scrapQty: 0,
      oeeTotal: 0,
      runs: 0
    });
  });
  productionLogs.forEach((log) => {
    const row = machineUtilMap.get(log.machineId);
    if (!row) return;
    row.runtimeMinutes += dateDiffMinutes(log.startAt, log.closeAt);
    row.goodQty += log.goodQty ?? 0;
    row.rejectQty += log.rejectQty ?? 0;
    row.scrapQty += log.scrapQty ?? 0;
    row.oeeTotal += log.oeePct ?? 0;
    row.runs += 1;
  });
  const machineUtilization = Array.from(machineUtilMap.values())
    .map((row) => ({
      ...row,
      utilizationPct: availableMinutesInRange > 0 ? (row.runtimeMinutes / availableMinutesInRange) * 100 : 0,
      avgOee: row.runs > 0 ? row.oeeTotal / row.runs : 0,
      yieldPct:
        row.goodQty + row.rejectQty + row.scrapQty > 0
          ? (row.goodQty / (row.goodQty + row.rejectQty + row.scrapQty)) * 100
          : 0,
      fixPath: "/production"
    }))
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const productionYieldTotals = productionLogs.reduce(
    (acc, log) => {
      acc.good += log.goodQty ?? 0;
      acc.reject += log.rejectQty ?? 0;
      acc.scrap += log.scrapQty ?? 0;
      return acc;
    },
    { good: 0, reject: 0, scrap: 0 }
  );
  const productionYieldBySkuMap = new Map<
    string,
    { skuId: string; code: string; name: string; good: number; reject: number; scrap: number }
  >();
  productionLogs.forEach((log) => {
    const existing = productionYieldBySkuMap.get(log.finishedSkuId) ?? {
      skuId: log.finishedSkuId,
      code: log.finishedSku.code,
      name: log.finishedSku.name,
      good: 0,
      reject: 0,
      scrap: 0
    };
    existing.good += log.goodQty ?? 0;
    existing.reject += log.rejectQty ?? 0;
    existing.scrap += log.scrapQty ?? 0;
    productionYieldBySkuMap.set(log.finishedSkuId, existing);
  });
  const productionYield = {
    goodQty: productionYieldTotals.good,
    rejectQty: productionYieldTotals.reject,
    scrapQty: productionYieldTotals.scrap,
    yieldPct:
      productionYieldTotals.good + productionYieldTotals.reject + productionYieldTotals.scrap > 0
        ? (productionYieldTotals.good /
            (productionYieldTotals.good + productionYieldTotals.reject + productionYieldTotals.scrap)) *
          100
        : 0,
    bySku: Array.from(productionYieldBySkuMap.values())
      .map((row) => ({
        ...row,
        yieldPct: row.good + row.reject + row.scrap > 0 ? (row.good / (row.good + row.reject + row.scrap)) * 100 : 0
      }))
      .sort((a, b) => b.good - a.good)
      .slice(0, 8)
  };

  const topSkuMap = new Map<
    string,
    { skuId: string; code: string; name: string; quantity: number; revenue: number; estimatedCost: number; actualCost: number }
  >();
  invoiceLines.forEach((line) => {
    const current = topSkuMap.get(line.skuId) ?? {
      skuId: line.skuId,
      code: line.sku.code,
      name: line.sku.name,
      quantity: 0,
      revenue: 0,
      estimatedCost: 0,
      actualCost: 0
    };
    current.quantity += line.quantity;
    current.revenue += lineNetTotal(line);
    const soQty = line.soLine.quantity || 1;
    const ratio = Math.max(0, line.quantity / soQty);
    current.estimatedCost += (line.soLine.expectedRawCost ?? 0) * ratio;
    current.actualCost += (line.soLine.actualRawCost ?? 0) * ratio;
    topSkuMap.set(line.skuId, current);
  });
  const topSkus = Array.from(topSkuMap.values())
    .map((row) => {
      const baseCost = row.actualCost > 0 ? row.actualCost : row.estimatedCost;
      const margin = row.revenue - baseCost;
      return {
        ...row,
        margin,
        marginPct: row.revenue > 0 ? (margin / row.revenue) * 100 : 0
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const openForCapacity = await prisma.salesOrderLine.findMany({
    where: {
      salesOrder: {
        companyId,
        deletedAt: null,
        status: { in: ["CONFIRMED", "PRODUCTION", "DISPATCH"] }
      }
    },
    include: { sku: { select: { id: true, code: true, name: true, unit: true } } }
  });
  const openBySkuMap = new Map<string, { openQty: number; code: string; name: string; unit: string }>();
  openForCapacity.forEach((line) => {
    const openQty = Math.max((line.quantity ?? 0) - (line.deliveredQty ?? 0) - (line.producedQty ?? 0), 0);
    if (openQty <= 0) return;
    const current = openBySkuMap.get(line.skuId) ?? {
      openQty: 0,
      code: line.sku.code,
      name: line.sku.name,
      unit: line.sku.unit
    };
    current.openQty += openQty;
    openBySkuMap.set(line.skuId, current);
  });
  const openSkuIds = Array.from(openBySkuMap.keys());
  const routingRows = openSkuIds.length
    ? await prisma.routing.findMany({
        where: { companyId, finishedSkuId: { in: openSkuIds }, deletedAt: null },
        include: { steps: { include: { machine: true } } }
      })
    : [];
  const bestStepBySku = new Map<
    string,
    { machineId: string; machineCode: string; machineName: string; capacityPerMinute: number }
  >();
  routingRows.forEach((routing) => {
    const best = routing.steps
      .filter((step) => step.capacityPerMinute > 0)
      .sort((a, b) => b.capacityPerMinute - a.capacityPerMinute)[0];
    if (!best) return;
    bestStepBySku.set(routing.finishedSkuId, {
      machineId: best.machineId,
      machineCode: best.machine.code,
      machineName: best.machine.name,
      capacityPerMinute: best.capacityPerMinute
    });
  });
  const requiredByMachine = new Map<string, { machineId: string; code: string; name: string; requiredMinutes: number }>();
  const missingRouting: Array<{ skuId: string; code: string; name: string; openQty: number; unit: string; fixPath: string }> = [];
  openBySkuMap.forEach((skuOpen, skuId) => {
    const best = bestStepBySku.get(skuId);
    if (!best) {
      missingRouting.push({
        skuId,
        code: skuOpen.code,
        name: skuOpen.name,
        openQty: skuOpen.openQty,
        unit: skuOpen.unit,
        fixPath: "/settings/master-data/finished-skus"
      });
      return;
    }
    const mins = skuOpen.openQty / best.capacityPerMinute;
    const current = requiredByMachine.get(best.machineId) ?? {
      machineId: best.machineId,
      code: best.machineCode,
      name: best.machineName,
      requiredMinutes: 0
    };
    current.requiredMinutes += mins;
    requiredByMachine.set(best.machineId, current);
  });
  const capacityRisk = Array.from(requiredByMachine.values())
    .map((row) => {
      const loadPct = availableMinutesCapacity > 0 ? (row.requiredMinutes / availableMinutesCapacity) * 100 : 0;
      const risk = loadPct > 100 ? "CRITICAL" : loadPct > 80 ? "HIGH" : loadPct > 60 ? "WATCH" : "LOW";
      return {
        ...row,
        availableMinutes: availableMinutesCapacity,
        loadPct,
        risk
      };
    })
    .sort((a, b) => b.loadPct - a.loadPct)
    .slice(0, 8);

  const totalReceivable = salesInvoices.reduce((sum, invoice) => sum + Math.max(invoice.balanceAmount ?? 0, 0), 0);
  const overdueReceivables = salesInvoices.filter(
    (invoice) => (invoice.balanceAmount ?? 0) > 0 && invoice.dueDate && invoice.dueDate < now
  );
  const overdueReceivableAmount = overdueReceivables.reduce((sum, invoice) => sum + (invoice.balanceAmount ?? 0), 0);
  const dueSoonReceivableAmount = salesInvoices
    .filter((invoice) => (invoice.balanceAmount ?? 0) > 0 && invoice.dueDate && invoice.dueDate >= now && invoice.dueDate <= nextWeek)
    .reduce((sum, invoice) => sum + (invoice.balanceAmount ?? 0), 0);
  const collectedInRange = salesPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const receivableAgingMap = new Map<string, number>();
  overdueReceivables.forEach((invoice) => {
    const days = Math.floor((now.getTime() - (invoice.dueDate as Date).getTime()) / 86400000);
    const bucket = computeAgingBucket(days);
    receivableAgingMap.set(bucket, (receivableAgingMap.get(bucket) ?? 0) + (invoice.balanceAmount ?? 0));
  });

  const totalPayable = vendorBills.reduce((sum, bill) => sum + Math.max(bill.balanceAmount ?? 0, 0), 0);
  const overduePayables = vendorBills.filter((bill) => (bill.balanceAmount ?? 0) > 0 && bill.dueDate && bill.dueDate < now);
  const overduePayableAmount = overduePayables.reduce((sum, bill) => sum + (bill.balanceAmount ?? 0), 0);
  const dueSoonPayableAmount = vendorBills
    .filter((bill) => (bill.balanceAmount ?? 0) > 0 && bill.dueDate && bill.dueDate >= now && bill.dueDate <= nextWeek)
    .reduce((sum, bill) => sum + (bill.balanceAmount ?? 0), 0);
  const paidInRange = vendorPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const payableAgingMap = new Map<string, number>();
  overduePayables.forEach((bill) => {
    const days = Math.floor((now.getTime() - (bill.dueDate as Date).getTime()) / 86400000);
    const bucket = computeAgingBucket(days);
    payableAgingMap.set(bucket, (payableAgingMap.get(bucket) ?? 0) + (bill.balanceAmount ?? 0));
  });

  const logByMachine = new Map<string, Date>();
  productionLogs.forEach((log) => {
    if (!log.machineId || !log.closeAt) return;
    const existing = logByMachine.get(log.machineId);
    if (!existing || log.closeAt > existing) {
      logByMachine.set(log.machineId, log.closeAt);
    }
  });
  const machineDowntime = machines
    .map((machine) => ({
      id: machine.id,
      code: machine.code,
      name: machine.name,
      lastRunAt: logByMachine.get(machine.id) ?? null,
      fixPath: "/production"
    }))
    .filter((machine) => !machine.lastRunAt || machine.lastRunAt < downtimeCutoff)
    .map((machine) => ({
      ...machine,
      lastRunAt: machine.lastRunAt ? machine.lastRunAt.toISOString() : null
    }))
    .slice(0, 8);

  const finishedRevenue = totalRevenue;
  const scrapRevenue = scrapSales.reduce((sum, sale) => sum + (sale.totalAmount ?? 0), 0);
  const scrapRevenueCost = scrapSales.reduce((sum, sale) => sum + (sale.totalCost ?? 0), 0);

  const skuProfitabilityAll = Array.from(topSkuMap.values()).map((row) => {
    const baseCost = row.actualCost > 0 ? row.actualCost : row.estimatedCost;
    const margin = row.revenue - baseCost;
    return {
      ...row,
      cost: baseCost,
      margin,
      marginPct: row.revenue > 0 ? (margin / row.revenue) * 100 : 0
    };
  });
  const finishedMargin = skuProfitabilityAll.reduce((sum, row) => sum + row.margin, 0);
  const scrapMargin = scrapRevenue - scrapRevenueCost;
  const combinedRevenue = finishedRevenue + scrapRevenue;
  const revenueSplit = {
    finishedRevenue,
    scrapRevenue,
    totalRevenue: combinedRevenue,
    scrapSharePct: combinedRevenue > 0 ? (scrapRevenue / combinedRevenue) * 100 : 0,
    finishedMargin,
    scrapMargin,
    totalMargin: finishedMargin + scrapMargin
  };

  const lossBySkuMap = new Map<
    string,
    {
      skuId: string;
      code: string;
      name: string;
      rejectQty: number;
      scrapQty: number;
      lossQty: number;
      lossCost: number;
      logs: number;
      fixPath: string;
    }
  >();
  const lossByMachineMap = new Map<
    string,
    {
      machineId: string;
      code: string;
      name: string;
      rejectQty: number;
      scrapQty: number;
      lossQty: number;
      lossCost: number;
      logs: number;
      fixPath: string;
    }
  >();
  let rejectCost = 0;
  let scrapCostFromProduction = 0;
  let materialVarianceLoss = 0;
  productionLogs.forEach((log) => {
    const good = log.goodQty ?? 0;
    const reject = log.rejectQty ?? 0;
    const scrap = log.scrapQty ?? 0;
    const totalOutput = good + reject + scrap;
    if (totalOutput <= 0) return;

    const derivedCostPerUnit =
      totalOutput > 0 && (log.actualRawCost ?? 0) > 0
        ? (log.actualRawCost ?? 0) / totalOutput
        : totalOutput > 0 && (log.expectedRawCost ?? 0) > 0
          ? (log.expectedRawCost ?? 0) / totalOutput
          : (log.finishedSku.manufacturingCost ?? 0);
    const rejectValue = reject * derivedCostPerUnit;
    const scrapValue = scrap * derivedCostPerUnit;
    rejectCost += rejectValue;
    scrapCostFromProduction += scrapValue;
    materialVarianceLoss += Math.max(log.materialVarianceCost ?? 0, 0);

    const skuLoss = lossBySkuMap.get(log.finishedSkuId) ?? {
      skuId: log.finishedSkuId,
      code: log.finishedSku.code,
      name: log.finishedSku.name,
      rejectQty: 0,
      scrapQty: 0,
      lossQty: 0,
      lossCost: 0,
      logs: 0,
      fixPath: "/production"
    };
    skuLoss.rejectQty += reject;
    skuLoss.scrapQty += scrap;
    skuLoss.lossQty += reject + scrap;
    skuLoss.lossCost += rejectValue + scrapValue;
    skuLoss.logs += 1;
    lossBySkuMap.set(log.finishedSkuId, skuLoss);

    const machineLoss = lossByMachineMap.get(log.machineId) ?? {
      machineId: log.machineId,
      code: log.machine.code,
      name: log.machine.name,
      rejectQty: 0,
      scrapQty: 0,
      lossQty: 0,
      lossCost: 0,
      logs: 0,
      fixPath: "/production"
    };
    machineLoss.rejectQty += reject;
    machineLoss.scrapQty += scrap;
    machineLoss.lossQty += reject + scrap;
    machineLoss.lossCost += rejectValue + scrapValue;
    machineLoss.logs += 1;
    lossByMachineMap.set(log.machineId, machineLoss);
  });
  const lossLeakage = {
    rejectCost,
    scrapCost: scrapCostFromProduction,
    materialVarianceCost: materialVarianceLoss,
    topLossSkus: Array.from(lossBySkuMap.values()).sort((a, b) => b.lossCost - a.lossCost).slice(0, 8),
    topLossMachines: Array.from(lossByMachineMap.values()).sort((a, b) => b.lossCost - a.lossCost).slice(0, 8)
  };

  const teamAveragePerformancePct =
    employeePerf.summary.length > 0
      ? employeePerf.summary.reduce((sum, row) => sum + row.performancePct, 0) / employeePerf.summary.length
      : 0;
  const employeeEfficiencyRows = employeePerf.summary.map((row) => ({
    ...row,
    varianceFromTeamPct: row.performancePct - teamAveragePerformancePct
  }));
  const employeeEfficiency = {
    teamAveragePerformancePct,
    top: [...employeeEfficiencyRows].sort((a, b) => b.performancePct - a.performancePct).slice(0, 8),
    bottom: [...employeeEfficiencyRows].sort((a, b) => a.performancePct - b.performancePct).slice(0, 8)
  };

  const machineEffectiveness = machineUtilization.map((row) => ({
    ...row,
    downtimeMinutes: Math.max(availableMinutesInRange - row.runtimeMinutes, 0),
    lossQty: row.rejectQty + row.scrapQty,
    throughputPerHour: row.runtimeMinutes > 0 ? (row.goodQty / row.runtimeMinutes) * 60 : 0
  }));

  const skuProfitability = {
    top: [...skuProfitabilityAll].sort((a, b) => b.margin - a.margin).slice(0, 8),
    bottom: [...skuProfitabilityAll].sort((a, b) => a.margin - b.margin).slice(0, 8)
  };

  const qtyBySku = new Map<string, { skuId: string; code: string; name: string; unit: string; qty: number }>();
  stockBalances.forEach((balance) => {
    const includeZone = ["RAW_MATERIAL", "FINISHED", "SCRAP"].includes(balance.zone.type);
    if (!includeZone) return;
    const current = qtyBySku.get(balance.skuId) ?? {
      skuId: balance.skuId,
      code: balance.sku.code,
      name: balance.sku.name,
      unit: balance.sku.unit,
      qty: 0
    };
    current.qty += balance.quantityOnHand;
    qtyBySku.set(balance.skuId, current);
  });
  const lastMoveBySkuMap = new Map(lastMovementBySku.map((row) => [row.skuId, row._max.createdAt]));
  const deadStock = Array.from(qtyBySku.values())
    .map((row) => {
      const lastMove = lastMoveBySkuMap.get(row.skuId) ?? null;
      const ageDays = lastMove ? Math.floor((now.getTime() - new Date(lastMove).getTime()) / 86400000) : 999;
      return { ...row, lastMove, ageDays, fixPath: "/inventory" };
    })
    .filter((row) => row.qty > 0 && row.ageDays >= DEAD_STOCK_DAYS)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);
  const slowMoving = Array.from(qtyBySku.values())
    .map((row) => {
      const lastMove = lastMoveBySkuMap.get(row.skuId) ?? null;
      const ageDays = lastMove ? Math.floor((now.getTime() - new Date(lastMove).getTime()) / 86400000) : 999;
      return { ...row, lastMove, ageDays, fixPath: "/inventory" };
    })
    .filter((row) => row.qty > 0 && row.ageDays >= SLOW_MOVING_DAYS && row.ageDays < DEAD_STOCK_DAYS)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);

  const rawOnHandBySku = new Map<string, { code: string; name: string; unit: string; onHand: number }>();
  stockBalances.forEach((balance) => {
    if (balance.zone.type !== "RAW_MATERIAL" || balance.sku.type !== "RAW") return;
    const current = rawOnHandBySku.get(balance.skuId) ?? {
      code: balance.sku.code,
      name: balance.sku.name,
      unit: balance.sku.unit,
      onHand: 0
    };
    current.onHand += balance.quantityOnHand;
    rawOnHandBySku.set(balance.skuId, current);
  });
  const usageBySkuInRange = new Map<string, number>();
  stockLedgerInRange.forEach((entry) => {
    if (entry.sku.type !== "RAW") return;
    if (entry.direction !== "OUT" || entry.movementType !== "ISSUE") return;
    usageBySkuInRange.set(entry.skuId, (usageBySkuInRange.get(entry.skuId) ?? 0) + entry.quantity);
  });
  const stockoutRisk = Array.from(rawOnHandBySku.entries())
    .map(([skuId, info]) => {
      const usage = usageBySkuInRange.get(skuId) ?? 0;
      const avgDailyUsage = usage / rangeDays;
      const daysCover = avgDailyUsage > 0 ? info.onHand / avgDailyUsage : null;
      return {
        skuId,
        ...info,
        avgDailyUsage,
        daysCover,
        fixPath: "/purchasing"
      };
    })
    .filter((row) => row.daysCover !== null && row.daysCover <= 14)
    .sort((a, b) => (a.daysCover ?? 999) - (b.daysCover ?? 999))
    .slice(0, 8);

  const rawBatchAging = rawBatchRows
    .map((batch) => ({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      skuId: batch.skuId,
      skuCode: batch.sku.code,
      skuName: batch.sku.name,
      unit: batch.sku.unit,
      quantityRemaining: batch.quantityRemaining,
      ageDays: Math.floor((now.getTime() - batch.receivedAt.getTime()) / 86400000),
      fixPath: "/inventory"
    }))
    .filter((batch) => batch.ageDays >= BATCH_AGING_DAYS)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);

  const inventoryHealth = {
    deadStock,
    slowMoving,
    stockoutRisk,
    rawBatchAging
  };

  const currentScrapRateBySku = new Map<string, { code: string; name: string; rate: number; scrap: number; total: number }>();
  const currentSkuTotals = new Map<string, { code: string; name: string; scrap: number; total: number }>();
  productionLogs.forEach((log) => {
    const total = (log.goodQty ?? 0) + (log.rejectQty ?? 0) + (log.scrapQty ?? 0);
    if (total <= 0) return;
    const current = currentSkuTotals.get(log.finishedSkuId) ?? {
      code: log.finishedSku.code,
      name: log.finishedSku.name,
      scrap: 0,
      total: 0
    };
    current.scrap += (log.rejectQty ?? 0) + (log.scrapQty ?? 0);
    current.total += total;
    currentSkuTotals.set(log.finishedSkuId, current);
  });
  currentSkuTotals.forEach((row, skuId) => {
    currentScrapRateBySku.set(skuId, {
      code: row.code,
      name: row.name,
      scrap: row.scrap,
      total: row.total,
      rate: row.total > 0 ? (row.scrap / row.total) * 100 : 0
    });
  });

  const previousSkuTotals = new Map<string, { scrap: number; total: number }>();
  previousProductionLogs.forEach((log) => {
    const total = (log.goodQty ?? 0) + (log.rejectQty ?? 0) + (log.scrapQty ?? 0);
    if (total <= 0) return;
    const current = previousSkuTotals.get(log.finishedSkuId) ?? { scrap: 0, total: 0 };
    current.scrap += (log.rejectQty ?? 0) + (log.scrapQty ?? 0);
    current.total += total;
    previousSkuTotals.set(log.finishedSkuId, current);
  });

  const highRejectAlerts = productionLogs
    .map((log) => {
      const total = (log.goodQty ?? 0) + (log.rejectQty ?? 0) + (log.scrapQty ?? 0);
      if (total <= 0) return null;
      const rejectPct = (((log.rejectQty ?? 0) + (log.scrapQty ?? 0)) / total) * 100;
      if (rejectPct < HIGH_REJECT_ALERT_PCT) return null;
      return {
        logId: log.id,
        machine: `${log.machine.code} · ${log.machine.name}`,
        sku: `${log.finishedSku.code} · ${log.finishedSku.name}`,
        rejectPct,
        fixPath: "/production"
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.rejectPct - a.rejectPct)
    .slice(0, 8);

  const scrapSpikeAlerts = Array.from(currentScrapRateBySku.entries())
    .map(([skuId, current]) => {
      const previous = previousSkuTotals.get(skuId);
      const previousRate = previous && previous.total > 0 ? (previous.scrap / previous.total) * 100 : 0;
      const delta = current.rate - previousRate;
      return {
        skuId,
        code: current.code,
        name: current.name,
        currentRate: current.rate,
        previousRate,
        delta,
        fixPath: "/production"
      };
    })
    .filter((row) => row.currentRate >= HIGH_REJECT_ALERT_PCT && row.delta >= SCRAP_SPIKE_ALERT_DELTA_PCT)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 8);

  return jsonOk({
    cards: {
      orderBacklogValue,
      totalRevenue,
      deliveryCompletionPct,
      inventoryValue,
      avgOee,
      receivablesOutstanding: totalReceivable,
      payablesOutstanding: totalPayable
    },
    productionOutput: {
      goodQty: productionYield.goodQty,
      rejectQty: productionYield.rejectQty,
      scrapQty: productionYield.scrapQty,
      totalQty: productionYield.goodQty + productionYield.rejectQty + productionYield.scrapQty,
      yieldPct: productionYield.yieldPct,
      rejectPct:
        productionYield.goodQty + productionYield.rejectQty + productionYield.scrapQty > 0
          ? (productionYield.rejectQty / (productionYield.goodQty + productionYield.rejectQty + productionYield.scrapQty)) *
            100
          : 0,
      scrapPct:
        productionYield.goodQty + productionYield.rejectQty + productionYield.scrapQty > 0
          ? (productionYield.scrapQty / (productionYield.goodQty + productionYield.rejectQty + productionYield.scrapQty)) *
            100
          : 0
    },
    revenueSplit,
    lossLeakage,
    topSkus,
    skuProfitability,
    machineUtilization,
    machineEffectiveness,
    capacityRisk: {
      windowDays: CAPACITY_WINDOW_DAYS,
      items: capacityRisk,
      missingRouting
    },
    productionYield,
    collections: {
      totalOutstanding: totalReceivable,
      overdueOutstanding: overdueReceivableAmount,
      dueIn7Days: dueSoonReceivableAmount,
      collectedInRange,
      aging: ["0-30", "31-60", "61-90", "90+"].map((bucket) => ({
        bucket,
        amount: receivableAgingMap.get(bucket) ?? 0
      }))
    },
    payables: {
      totalOutstanding: totalPayable,
      overdueOutstanding: overduePayableAmount,
      dueIn7Days: dueSoonPayableAmount,
      paidInRange,
      aging: ["0-30", "31-60", "61-90", "90+"].map((bucket) => ({
        bucket,
        amount: payableAgingMap.get(bucket) ?? 0
      }))
    },
    inventoryHealth,
    alerts: {
      lowStock,
      delayedDeliveries,
      machineDowntime,
      highReject: highRejectAlerts,
      scrapSpike: scrapSpikeAlerts,
      overdueReceivables: overdueReceivables.slice(0, 8).map((invoice) => ({
        invoiceNumber: invoice.invoiceNumber ?? "—",
        customer: invoice.salesOrder.customer.name,
        soNumber: invoice.salesOrder.soNumber ?? "—",
        dueDate: invoice.dueDate?.toISOString() ?? null,
        balanceAmount: invoice.balanceAmount ?? 0,
        fixPath: "/sales-orders"
      })),
      overduePayables: overduePayables.slice(0, 8).map((bill) => ({
        billNumber: bill.billNumber ?? "—",
        vendor: bill.vendor.name,
        dueDate: bill.dueDate?.toISOString() ?? null,
        balanceAmount: bill.balanceAmount ?? 0,
        fixPath: "/purchasing"
      }))
    },
    employeePerformance: {
      date: from.toISOString().slice(0, 10),
      topEmployees: employeePerf.summary.slice(0, 8)
    },
    employeeEfficiency
  });
}
