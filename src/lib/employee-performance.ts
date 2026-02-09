import type { Prisma } from "@prisma/client";

export type EmployeePerformanceRow = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: string;
  minutes: number;
  expectedUnits: number;
  actualUnits: number;
  performancePct: number;
  expectedRawCost: number;
  actualRawCost: number;
  materialVariancePct: number;
  rating: number;
};

export type EmployeePerformanceSummary = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  minutes: number;
  expectedUnits: number;
  actualUnits: number;
  performancePct: number;
  expectedRawCost: number;
  actualRawCost: number;
  materialVariancePct: number;
  rating: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function computeEmployeePerformance({
  companyId,
  from,
  to,
  tx
}: {
  companyId: string;
  from: Date;
  to: Date;
  tx: Prisma.TransactionClient;
}) {
  const [logs, machineSkus] = await Promise.all([
    tx.productionLog.findMany({
      where: { companyId, deletedAt: null, closeAt: { not: null, gte: from, lte: to } },
      include: {
        machine: true,
        finishedSku: true,
        crewAssignments: { include: { employee: true } }
      }
    }),
    tx.machineSku.findMany({
      where: { companyId, deletedAt: null },
      select: { machineId: true, skuId: true, capacityPerMinute: true }
    })
  ]);

  const capacityMap = new Map<string, number>();
  machineSkus.forEach((mapping) => {
    capacityMap.set(`${mapping.machineId}:${mapping.skuId}`, mapping.capacityPerMinute);
  });

  const dailyMap = new Map<string, EmployeePerformanceRow>();

  logs.forEach((log) => {
    if (!log.closeAt) return;
    const logStart = log.startAt ?? log.closeAt;
    const logEnd = log.closeAt;
    const dateKey = logEnd.toISOString().slice(0, 10);

    const crewDurations = log.crewAssignments
      .map((entry) => {
        const startAt = entry.startAt ?? logStart;
        const endAt = entry.endAt ?? logEnd;
        const minutes = Math.max(0, (endAt.getTime() - startAt.getTime()) / 60000);
        return { entry, minutes };
      })
      .filter((item) => item.minutes > 0);

    if (!crewDurations.length) return;

    const totalCrewMinutes = crewDurations.reduce((sum, item) => sum + item.minutes, 0);
    if (totalCrewMinutes <= 0) return;

    const capacity =
      capacityMap.get(`${log.machineId}:${log.finishedSkuId}`) ??
      log.machine.baseCapacityPerMinute ??
      0;
    const actualGoodQty = log.goodQty ?? 0;
    const expectedRawCost = log.expectedRawCost ?? 0;
    const actualRawCost = log.actualRawCost ?? expectedRawCost;

    crewDurations.forEach(({ entry, minutes }) => {
      const share = minutes / totalCrewMinutes;
      const actualUnits = actualGoodQty * share;
      const expectedUnits = capacity * minutes;
      const performancePct = expectedUnits > 0 ? (actualUnits / expectedUnits) * 100 : 0;
      const rating = expectedUnits > 0 ? clamp((actualUnits / expectedUnits) * 10, 0, 10) : 0;

      const key = `${entry.employeeId}:${dateKey}`;
      const current = dailyMap.get(key) ?? {
        employeeId: entry.employeeId,
        employeeCode: entry.employee.code,
        employeeName: entry.employee.name,
        date: dateKey,
        minutes: 0,
        expectedUnits: 0,
        actualUnits: 0,
        performancePct: 0,
        expectedRawCost: 0,
        actualRawCost: 0,
        materialVariancePct: 0,
        rating: 0
      };

      current.minutes += minutes;
      current.expectedUnits += expectedUnits;
      current.actualUnits += actualUnits;
      current.performancePct = current.expectedUnits > 0 ? (current.actualUnits / current.expectedUnits) * 100 : 0;
      current.rating = current.expectedUnits > 0 ? clamp((current.actualUnits / current.expectedUnits) * 10, 0, 10) : 0;
      current.expectedRawCost += expectedRawCost * share;
      current.actualRawCost += actualRawCost * share;
      current.materialVariancePct =
        current.expectedRawCost > 0
          ? ((current.actualRawCost - current.expectedRawCost) / current.expectedRawCost) * 100
          : 0;

      dailyMap.set(key, current);
    });
  });

  const daily = Array.from(dailyMap.values()).sort((a, b) => {
    if (a.date === b.date) return b.rating - a.rating;
    return b.date.localeCompare(a.date);
  });

  const summaryMap = new Map<string, EmployeePerformanceSummary>();
  daily.forEach((row) => {
    const current = summaryMap.get(row.employeeId) ?? {
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      employeeName: row.employeeName,
      minutes: 0,
      expectedUnits: 0,
      actualUnits: 0,
      performancePct: 0,
      expectedRawCost: 0,
      actualRawCost: 0,
      materialVariancePct: 0,
      rating: 0
    };
    current.minutes += row.minutes;
    current.expectedUnits += row.expectedUnits;
    current.actualUnits += row.actualUnits;
    current.performancePct = current.expectedUnits > 0 ? (current.actualUnits / current.expectedUnits) * 100 : 0;
    current.rating = current.expectedUnits > 0 ? clamp((current.actualUnits / current.expectedUnits) * 10, 0, 10) : 0;
    current.expectedRawCost += row.expectedRawCost;
    current.actualRawCost += row.actualRawCost;
    current.materialVariancePct =
      current.expectedRawCost > 0
        ? ((current.actualRawCost - current.expectedRawCost) / current.expectedRawCost) * 100
        : 0;
    summaryMap.set(row.employeeId, current);
  });

  const summary = Array.from(summaryMap.values()).sort((a, b) => b.rating - a.rating);

  return { daily, summary };
}
