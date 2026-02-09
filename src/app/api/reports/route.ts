import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { computeEmployeePerformance } from "@/lib/employee-performance";

export const dynamic = "force-dynamic";

export async function GET() {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const now = new Date();
  const weekCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [stockBalances, salesOrders, purchaseOrders, productionLogs, employeePerf] = await Promise.all([
    prisma.stockBalance.findMany({ where: { companyId } }),
    prisma.salesOrder.findMany({
      where: { companyId, deletedAt: null },
      include: { customer: true, lines: true }
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId, deletedAt: null },
      include: { vendor: true, lines: true }
    }),
    prisma.productionLog.findMany({
      where: { companyId, deletedAt: null, status: "CLOSED", closeAt: { gte: weekCutoff } },
      include: { machine: true }
    }),
    computeEmployeePerformance({ companyId, from: weekCutoff, to: now, tx: prisma })
  ]);

  const inventoryValue = stockBalances.reduce((sum, balance) => sum + balance.totalCost, 0);

  const salesByCustomerMap = new Map<string, { customerId: string; customer: string; value: number }>();
  salesOrders.forEach((order) => {
    const customerName = order.customer?.name ?? "Unknown";
    const current = salesByCustomerMap.get(order.customerId) ?? {
      customerId: order.customerId,
      customer: customerName,
      value: 0
    };
    order.lines.forEach((line) => {
      const discount = line.discountPct ?? 0;
      const tax = line.taxPct ?? 0;
      const discounted = line.unitPrice * (1 - discount / 100);
      current.value += line.quantity * discounted * (1 + tax / 100);
    });
    salesByCustomerMap.set(order.customerId, current);
  });
  const salesByCustomer = Array.from(salesByCustomerMap.values()).sort((a, b) => b.value - a.value);

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
    }
  >();

  purchaseOrders.forEach((order) => {
    const current = vendorSummaryMap.get(order.vendorId) ?? {
      vendorId: order.vendorId,
      vendor: order.vendor?.name ?? "Unknown",
      totalValue: 0,
      draft: 0,
      pending: 0,
      approved: 0,
      received: 0,
      cancelled: 0
    };

    const value = order.lines.reduce((sum, line) => {
      const discount = line.discountPct ?? 0;
      const tax = line.taxPct ?? 0;
      const discounted = line.unitPrice * (1 - discount / 100);
      return sum + line.quantity * discounted * (1 + tax / 100);
    }, 0);

    current.totalValue += value;
    if (order.status === "DRAFT") current.draft += 1;
    if (order.status === "PENDING") current.pending += 1;
    if (order.status === "APPROVED") current.approved += 1;
    if (order.status === "RECEIVED") current.received += 1;
    if (order.status === "CANCELLED") current.cancelled += 1;

    vendorSummaryMap.set(order.vendorId, current);
  });

  const vendorSummary = Array.from(vendorSummaryMap.values()).sort((a, b) => b.totalValue - a.totalValue);

  const oeeAvg = productionLogs.length
    ? productionLogs.reduce((sum, log) => sum + (log.oeePct ?? 0), 0) / productionLogs.length
    : 0;

  const oeeByMachineMap = new Map<
    string,
    { machine: string; avgOee: number; runs: number; expectedRawCost: number; actualRawCost: number }
  >();
  productionLogs.forEach((log) => {
    const key = log.machineId;
    const current = oeeByMachineMap.get(key) ?? {
      machine: log.machine.name,
      avgOee: 0,
      runs: 0,
      expectedRawCost: 0,
      actualRawCost: 0
    };
    current.avgOee += log.oeePct ?? 0;
    current.runs += 1;
    current.expectedRawCost += log.expectedRawCost ?? 0;
    current.actualRawCost += log.actualRawCost ?? (log.expectedRawCost ?? 0);
    oeeByMachineMap.set(key, current);
  });

  const oeeByMachine = Array.from(oeeByMachineMap.values()).map((item) => ({
    machine: item.machine,
    avgOee: item.runs ? item.avgOee / item.runs : 0,
    runs: item.runs,
    materialVariancePct:
      item.expectedRawCost > 0 ? ((item.actualRawCost - item.expectedRawCost) / item.expectedRawCost) * 100 : 0
  }));

  return jsonOk({
    inventoryValue,
    salesByCustomer,
    vendorSummary,
    oeeSnapshot: {
      averageOee: oeeAvg,
      totalRuns: productionLogs.length,
      byMachine: oeeByMachine
    },
    employeePerformance: {
      summary: employeePerf.summary,
      daily: employeePerf.daily
    }
  });
}
