import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { computeEmployeePerformance } from "@/lib/employee-performance";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 5;
const DELAY_DAYS = 7;
const DOWNTIME_HOURS = 48;

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

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const url = new URL(request.url);
  const { from, to } = parseDateRange(url.searchParams);
  const now = new Date();
  const delayCutoff = new Date(now.getTime() - DELAY_DAYS * 24 * 60 * 60 * 1000);
  const downtimeCutoff = new Date(now.getTime() - DOWNTIME_HOURS * 60 * 60 * 1000);

  const [salesLines, stockBalances, productionLogs, machines, employeePerf, skus, invoiceLines] = await Promise.all([
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
        salesOrder: { select: { id: true, soNumber: true, orderDate: true, status: true, customer: { select: { name: true } } } },
        sku: { select: { code: true, name: true, unit: true } }
      }
    }),
    prisma.stockBalance.findMany({
      where: { companyId },
      include: { sku: true, zone: true }
    }),
    prisma.productionLog.findMany({
      where: { companyId, deletedAt: null, status: "CLOSED", closeAt: { not: null } },
      include: { machine: true },
      orderBy: { closeAt: "desc" }
    }),
    prisma.machine.findMany({
      where: { companyId, deletedAt: null }
    }),
    (() => {
      return computeEmployeePerformance({ companyId, from, to, tx: prisma });
    })(),
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
      }
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

  const recentOee = productionLogs.filter((log) => log.closeAt && log.closeAt >= delayCutoff && log.oeePct !== null);
  const avgOee = recentOee.length
    ? recentOee.reduce((sum, log) => sum + (log.oeePct ?? 0), 0) / recentOee.length
    : 0;

  const totalRevenue = invoiceLines.reduce((sum, line) => {
    const discount = line.discountPct ?? 0;
    const tax = line.taxPct ?? 0;
    const discounted = line.unitPrice * (1 - discount / 100);
    return sum + line.quantity * discounted * (1 + tax / 100);
  }, 0);

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
      const threshold =
        sku.lowStockThreshold ?? (sku.type === "RAW" ? LOW_STOCK_THRESHOLD : null);
      if (threshold === null || threshold === undefined) return null;
      return {
        skuId: sku.id,
        code: sku.code,
        name: sku.name,
        unit: sku.unit,
        skuType: sku.type,
        onHand,
        threshold,
        shortage: Math.max(threshold - onHand, 0)
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.onHand <= item.threshold)
    .sort((a, b) => a.onHand - b.onHand)
    .slice(0, 6);

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
        daysOpen
      };
    })
    .sort((a, b) => b.daysOpen - a.daysOpen)
    .slice(0, 6);

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
      lastRunAt: logByMachine.get(machine.id) ?? null
    }))
    .filter((machine) => !machine.lastRunAt || machine.lastRunAt < downtimeCutoff)
    .map((machine) => ({
      ...machine,
      lastRunAt: machine.lastRunAt ? machine.lastRunAt.toISOString() : null
    }))
    .slice(0, 6);

  return jsonOk({
    cards: {
      orderBacklogValue,
      totalRevenue,
      deliveryCompletionPct,
      inventoryValue,
      avgOee
    },
    alerts: {
      lowStock,
      delayedDeliveries,
      machineDowntime
    },
    employeePerformance: {
      date: from.toISOString().slice(0, 10),
      topEmployees: employeePerf.summary.slice(0, 5)
    }
  });
}
