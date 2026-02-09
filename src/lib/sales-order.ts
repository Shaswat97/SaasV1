import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AvailabilityLineSummary = {
  lineId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  unit: string;
  orderedQty: number;
  deliveredQty: number;
  finishedFromStock: number;
  productionRequired: number;
  bottleneckCapacity: number | null;
  estimatedMinutes: number | null;
  routingSteps: number;
  routingDetail: Array<{
    machineId: string;
    machineCode: string;
    machineName: string;
    capacityPerMinute: number;
    minutes: number | null;
  }>;
  rawNeeds: Array<{
    rawSkuId: string;
    rawSkuCode: string;
    rawSkuName: string;
    unit: string;
    requiredQty: number;
  }>;
};

export type AvailabilitySummary = {
  finished: Array<{
    skuId: string;
    skuCode: string;
    skuName: string;
    unit: string;
    onHand: number;
  }>;
  raw: Array<{
    rawSkuId: string;
    rawSkuCode: string;
    rawSkuName: string;
    unit: string;
    requiredQty: number;
    onHandQty: number;
    onHandTotal: number;
    reservedQty: number;
    shortageQty: number;
  }>;
  lines: AvailabilityLineSummary[];
};

export async function computeAvailabilitySummary({
  companyId,
  lines,
  tx,
  excludeSoLineIds
}: {
  companyId: string;
  lines: Array<{ id: string; skuId: string; quantity: number; deliveredQty?: number | null }>;
  tx?: Prisma.TransactionClient;
  excludeSoLineIds?: string[];
}): Promise<AvailabilitySummary> {
  const db = tx ?? prisma;
  const finishedSkuIds = Array.from(new Set(lines.map((line) => line.skuId)));

  const finishedSkus = await db.sku.findMany({
    where: { id: { in: finishedSkuIds }, companyId, deletedAt: null },
    select: { id: true, code: true, name: true, unit: true }
  });

  const finishedSkuMap = new Map(finishedSkus.map((sku) => [sku.id, sku]));

  const finishedBalances = await db.stockBalance.findMany({
    where: { companyId, skuId: { in: finishedSkuIds }, zone: { type: "FINISHED" } },
    select: { skuId: true, quantityOnHand: true }
  });

  const routingRows = await db.routing.findMany({
    where: { companyId, finishedSkuId: { in: finishedSkuIds }, deletedAt: null },
    include: { steps: { include: { machine: true } } }
  });

  const routingMap = new Map<string, { bottleneckCapacity: number | null; routingSteps: number }>();
  const routingDetailMap = new Map<
    string,
    Array<{
      machineId: string;
      machineCode: string;
      machineName: string;
      capacityPerMinute: number;
      sequence: number;
    }>
  >();
  routingRows.forEach((routing) => {
    const capacities = routing.steps.map((step) => step.capacityPerMinute).filter((value) => value > 0);
    const bottleneckCapacity = capacities.length ? Math.min(...capacities) : null;
    routingMap.set(routing.finishedSkuId, {
      bottleneckCapacity,
      routingSteps: routing.steps.length
    });
    routingDetailMap.set(
      routing.finishedSkuId,
      routing.steps
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((step) => ({
          machineId: step.machineId,
          machineCode: step.machine.code,
          machineName: step.machine.name,
          capacityPerMinute: step.capacityPerMinute,
          sequence: step.sequence
        }))
    );
  });

  const finishedOnHand = new Map<string, number>();
  finishedBalances.forEach((balance) => {
    finishedOnHand.set(balance.skuId, (finishedOnHand.get(balance.skuId) ?? 0) + balance.quantityOnHand);
  });

  const boms = await db.bom.findMany({
    where: { companyId, finishedSkuId: { in: finishedSkuIds }, deletedAt: null },
    include: { lines: { include: { rawSku: true } } },
    orderBy: { version: "desc" }
  });

  const bomByFinished = new Map<string, typeof boms[number]>();
  boms.forEach((bom) => {
    if (!bomByFinished.has(bom.finishedSkuId)) {
      bomByFinished.set(bom.finishedSkuId, bom);
    }
  });

  const rawSkuMap = new Map<string, { id: string; code: string; name: string; unit: string }>();
  boms.forEach((bom) => {
    bom.lines.forEach((line) => {
      rawSkuMap.set(line.rawSkuId, {
        id: line.rawSkuId,
        code: line.rawSku.code,
        name: line.rawSku.name,
        unit: line.rawSku.unit
      });
    });
  });

  const rawSkuIds = Array.from(rawSkuMap.keys());
  const rawBalances = rawSkuIds.length
    ? await db.stockBalance.findMany({
        where: { companyId, skuId: { in: rawSkuIds }, zone: { type: "RAW_MATERIAL" } },
        select: { skuId: true, quantityOnHand: true }
      })
    : [];

  const rawOnHand = new Map<string, number>();
  rawBalances.forEach((balance) => {
    rawOnHand.set(balance.skuId, (rawOnHand.get(balance.skuId) ?? 0) + balance.quantityOnHand);
  });

  const reservationRows = rawSkuIds.length
    ? await db.stockReservation.findMany({
        where: {
          companyId,
          releasedAt: null,
          skuId: { in: rawSkuIds },
          ...(excludeSoLineIds && excludeSoLineIds.length ? { soLineId: { notIn: excludeSoLineIds } } : {})
        },
        select: { skuId: true, quantity: true }
      })
    : [];

  const reservedBySku = new Map<string, number>();
  reservationRows.forEach((row) => {
    reservedBySku.set(row.skuId, (reservedBySku.get(row.skuId) ?? 0) + row.quantity);
  });

  const availableFinished = new Map(finishedOnHand);
  const rawTotals = new Map<string, number>();
  const lineSummaries: AvailabilityLineSummary[] = lines.map((line) => {
    const sku = finishedSkuMap.get(line.skuId);
    const orderedQty = line.quantity;
    const deliveredQty = line.deliveredQty ?? 0;
    const remainingQty = Math.max(orderedQty - deliveredQty, 0);
    const available = availableFinished.get(line.skuId) ?? 0;
    const fromStock = Math.min(available, remainingQty);
    availableFinished.set(line.skuId, Math.max(available - fromStock, 0));
    const productionRequired = Math.max(remainingQty - fromStock, 0);
    const routingInfo = routingMap.get(line.skuId);
    const bottleneckCapacity = routingInfo?.bottleneckCapacity ?? null;
    const estimatedMinutes =
      bottleneckCapacity && productionRequired > 0 ? productionRequired / bottleneckCapacity : null;
    const routingSteps = routingInfo?.routingSteps ?? 0;
    const routingDetail =
      routingDetailMap.get(line.skuId)?.map((step) => ({
        machineId: step.machineId,
        machineCode: step.machineCode,
        machineName: step.machineName,
        capacityPerMinute: step.capacityPerMinute,
        minutes:
          step.capacityPerMinute > 0 && productionRequired > 0 ? productionRequired / step.capacityPerMinute : null
      })) ?? [];

    const bom = bomByFinished.get(line.skuId);
    const rawNeeds = (bom?.lines ?? []).map((bomLine) => {
      const requiredQty = productionRequired * bomLine.quantity;
      rawTotals.set(bomLine.rawSkuId, (rawTotals.get(bomLine.rawSkuId) ?? 0) + requiredQty);
      const rawSku = rawSkuMap.get(bomLine.rawSkuId);
      return {
        rawSkuId: bomLine.rawSkuId,
        rawSkuCode: rawSku?.code ?? "RAW",
        rawSkuName: rawSku?.name ?? "Raw SKU",
        unit: rawSku?.unit ?? "",
        requiredQty
      };
    });

    return {
      lineId: line.id,
      skuId: line.skuId,
      skuCode: sku?.code ?? "SKU",
      skuName: sku?.name ?? "Finished SKU",
      unit: sku?.unit ?? "",
      orderedQty,
      deliveredQty,
      finishedFromStock: fromStock,
      productionRequired,
      bottleneckCapacity,
      estimatedMinutes,
      routingSteps,
      routingDetail,
      rawNeeds
    };
  });

  const finishedSummary = finishedSkus.map((sku) => ({
    skuId: sku.id,
    skuCode: sku.code,
    skuName: sku.name,
    unit: sku.unit,
    onHand: finishedOnHand.get(sku.id) ?? 0
  }));

  const rawSummary = rawSkuIds.map((rawId) => {
    const rawSku = rawSkuMap.get(rawId);
    const requiredQty = rawTotals.get(rawId) ?? 0;
    const onHandTotal = rawOnHand.get(rawId) ?? 0;
    const reservedQty = reservedBySku.get(rawId) ?? 0;
    const onHandQty = Math.max(onHandTotal - reservedQty, 0);
    return {
      rawSkuId: rawId,
      rawSkuCode: rawSku?.code ?? "RAW",
      rawSkuName: rawSku?.name ?? "Raw SKU",
      unit: rawSku?.unit ?? "",
      requiredQty,
      onHandQty,
      onHandTotal,
      reservedQty,
      shortageQty: Math.max(requiredQty - onHandQty, 0)
    };
  });

  return { finished: finishedSummary, raw: rawSummary, lines: lineSummaries };
}

export type ProcurementPlan = {
  vendorPlans: Array<{
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    lines: Array<{
      rawSkuId: string;
      rawSkuCode: string;
      rawSkuName: string;
      unit: string;
      shortageQty: number;
      unitPrice: number;
    }>;
    totalValue: number;
  }>;
  skipped: Array<{ rawSkuId: string; rawSkuCode: string; rawSkuName: string; reason: string }>;
};

export async function buildProcurementPlan({
  companyId,
  lines,
  availability,
  tx,
  excludeSoLineIds
}: {
  companyId: string;
  lines: Array<{ id: string; skuId: string; quantity: number; deliveredQty?: number | null }>;
  availability?: AvailabilitySummary;
  tx?: Prisma.TransactionClient;
  excludeSoLineIds?: string[];
}): Promise<ProcurementPlan> {
  const db = tx ?? prisma;
  const availabilitySummary =
    availability ??
    (await computeAvailabilitySummary({
      companyId,
      lines,
      tx,
      excludeSoLineIds
    }));

  const allocationRows = await db.purchaseOrderAllocation.findMany({
    where: { soLineId: { in: lines.map((line) => line.id) } },
    include: {
      poLine: {
        select: {
          skuId: true,
          purchaseOrder: { select: { status: true, deletedAt: true } }
        }
      }
    }
  });

  const allocatedByRaw = new Map<string, number>();
  allocationRows.forEach((allocation) => {
    if (allocation.poLine.purchaseOrder?.deletedAt) return;
    if (allocation.poLine.purchaseOrder?.status === "CANCELLED") return;
    const rawSkuId = allocation.poLine.skuId;
    allocatedByRaw.set(rawSkuId, (allocatedByRaw.get(rawSkuId) ?? 0) + allocation.quantity);
  });

  const rawSkus = availabilitySummary.raw.length
    ? await db.sku.findMany({
        where: { id: { in: availabilitySummary.raw.map((raw) => raw.rawSkuId) }, companyId, deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          preferredVendorId: true,
          lastPurchasePrice: true,
          standardCost: true
        }
      })
    : [];

  const rawSkuMap = new Map(rawSkus.map((sku) => [sku.id, sku]));
  const vendorBuckets = new Map<string, Array<{ rawSkuId: string; shortageQty: number; unitPrice: number }>>();
  const skipped: Array<{ rawSkuId: string; rawSkuCode: string; rawSkuName: string; reason: string }> = [];

  availabilitySummary.raw.forEach((raw) => {
    const allocated = allocatedByRaw.get(raw.rawSkuId) ?? 0;
    const shortageQty = Math.max(raw.requiredQty - raw.onHandQty - allocated, 0);
    if (shortageQty <= 0) return;

    const rawSku = rawSkuMap.get(raw.rawSkuId);
    const vendorId = rawSku?.preferredVendorId;
    if (!vendorId) {
      skipped.push({
        rawSkuId: raw.rawSkuId,
        rawSkuCode: raw.rawSkuCode,
        rawSkuName: raw.rawSkuName,
        reason: "Missing preferred vendor"
      });
      return;
    }

    const unitPrice = rawSku?.lastPurchasePrice ?? rawSku?.standardCost ?? 0;
    if (!vendorBuckets.has(vendorId)) vendorBuckets.set(vendorId, []);
    vendorBuckets.get(vendorId)!.push({ rawSkuId: raw.rawSkuId, shortageQty, unitPrice });
  });

  const vendors = vendorBuckets.size
    ? await db.vendor.findMany({
        where: { id: { in: Array.from(vendorBuckets.keys()) }, companyId, deletedAt: null },
        select: { id: true, code: true, name: true }
      })
    : [];

  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const vendorPlans = Array.from(vendorBuckets.entries()).map(([vendorId, items]) => {
    const vendor = vendorMap.get(vendorId);
    const lines = items.map((item) => {
      const rawSku = rawSkuMap.get(item.rawSkuId);
      return {
        rawSkuId: item.rawSkuId,
        rawSkuCode: rawSku?.code ?? "RAW",
        rawSkuName: rawSku?.name ?? "Raw SKU",
        unit: rawSku?.unit ?? "",
        shortageQty: item.shortageQty,
        unitPrice: item.unitPrice
      };
    });
    const totalValue = lines.reduce((sum, line) => sum + line.shortageQty * line.unitPrice, 0);
    return {
      vendorId,
      vendorCode: vendor?.code ?? "VENDOR",
      vendorName: vendor?.name ?? "Vendor",
      lines,
      totalValue
    };
  });

  return { vendorPlans, skipped };
}

export async function reserveRawForSalesOrder({
  companyId,
  availability,
  tx
}: {
  companyId: string;
  availability: AvailabilitySummary;
  tx: Prisma.TransactionClient;
}) {
  const now = new Date();

  for (const line of availability.lines) {
    for (const rawNeed of line.rawNeeds) {
      if (rawNeed.requiredQty <= 0) continue;
      await tx.stockReservation.upsert({
        where: { soLineId_skuId: { soLineId: line.lineId, skuId: rawNeed.rawSkuId } },
        update: { quantity: rawNeed.requiredQty, releasedAt: null, updatedAt: now },
        create: {
          companyId,
          soLineId: line.lineId,
          skuId: rawNeed.rawSkuId,
          quantity: rawNeed.requiredQty
        }
      });
    }
  }
}

export async function releaseRawReservationForLine({
  soLineId,
  skuId,
  quantity,
  tx
}: {
  soLineId: string;
  skuId: string;
  quantity: number;
  tx: Prisma.TransactionClient;
}) {
  if (quantity <= 0) return;
  const reservation = await tx.stockReservation.findUnique({
    where: { soLineId_skuId: { soLineId, skuId } }
  });
  if (!reservation || reservation.releasedAt) return;
  const nextQty = reservation.quantity - quantity;
  await tx.stockReservation.update({
    where: { id: reservation.id },
    data: {
      quantity: nextQty > 0 ? nextQty : 0,
      releasedAt: nextQty > 0 ? null : new Date()
    }
  });
}

export async function autoDraftPurchaseOrders({
  companyId,
  salesOrderId,
  soNumber,
  lines,
  tx
}: {
  companyId: string;
  salesOrderId: string;
  soNumber?: string | null;
  lines: Array<{ id: string; skuId: string; quantity: number; deliveredQty?: number | null }>;
  tx: Prisma.TransactionClient;
}) {
  const availability = await computeAvailabilitySummary({
    companyId,
    lines,
    tx,
    excludeSoLineIds: lines.map((line) => line.id)
  });

  const allocationRows = await tx.purchaseOrderAllocation.findMany({
    where: { soLineId: { in: lines.map((line) => line.id) } },
    include: { poLine: { select: { skuId: true } } }
  });

  const allocatedByRaw = new Map<string, number>();
  const allocatedByLineRaw = new Map<string, Map<string, number>>();

  allocationRows.forEach((allocation) => {
    const rawSkuId = allocation.poLine.skuId;
    allocatedByRaw.set(rawSkuId, (allocatedByRaw.get(rawSkuId) ?? 0) + allocation.quantity);
    if (!allocatedByLineRaw.has(allocation.soLineId)) {
      allocatedByLineRaw.set(allocation.soLineId, new Map());
    }
    const lineMap = allocatedByLineRaw.get(allocation.soLineId)!;
    lineMap.set(rawSkuId, (lineMap.get(rawSkuId) ?? 0) + allocation.quantity);
  });

  const rawSkus = availability.raw.length
    ? await tx.sku.findMany({
        where: { id: { in: availability.raw.map((raw) => raw.rawSkuId) }, companyId, deletedAt: null },
        select: { id: true, code: true, name: true, unit: true, preferredVendorId: true, lastPurchasePrice: true, standardCost: true }
      })
    : [];

  const rawSkuMap = new Map(rawSkus.map((sku) => [sku.id, sku]));
  const vendorBuckets = new Map<string, Array<{ rawSkuId: string; shortageQty: number; unitPrice: number }>>();
  const skipped: Array<{ rawSkuId: string; reason: string }> = [];

  const preferredVendorIds = Array.from(
    new Set(rawSkus.map((sku) => sku.preferredVendorId).filter((id): id is string => Boolean(id)))
  );
  const vendorSkuRows = preferredVendorIds.length
    ? await tx.vendorSku.findMany({
        where: { companyId, vendorId: { in: preferredVendorIds }, skuId: { in: rawSkus.map((sku) => sku.id) } },
        select: { vendorId: true, skuId: true, lastPrice: true }
      })
    : [];
  const vendorSkuMap = new Map(vendorSkuRows.map((row) => [`${row.vendorId}:${row.skuId}`, row]));

  availability.raw.forEach((raw) => {
    const allocated = allocatedByRaw.get(raw.rawSkuId) ?? 0;
    const effectiveNeeded = Math.max(raw.requiredQty - allocated, 0);
    const shortageQty = Math.max(effectiveNeeded - raw.onHandQty, 0);
    if (shortageQty <= 0) return;

    const rawSku = rawSkuMap.get(raw.rawSkuId);
    const vendorId = rawSku?.preferredVendorId;
    if (!vendorId) {
      skipped.push({ rawSkuId: raw.rawSkuId, reason: "Missing preferred vendor" });
      return;
    }

    const vendorPrice = vendorSkuMap.get(`${vendorId}:${raw.rawSkuId}`)?.lastPrice ?? null;
    const unitPrice = vendorPrice ?? rawSku.lastPurchasePrice ?? rawSku.standardCost ?? 0;
    if (!vendorBuckets.has(vendorId)) vendorBuckets.set(vendorId, []);
    vendorBuckets.get(vendorId)!.push({ rawSkuId: raw.rawSkuId, shortageQty, unitPrice });
  });

  const createdPoIds: string[] = [];
  let createdLines = 0;

  for (const [vendorId, items] of vendorBuckets.entries()) {
    let purchaseOrder = await tx.purchaseOrder.findFirst({
      where: { companyId, vendorId, status: "DRAFT", deletedAt: null },
      select: { id: true, poNumber: true }
    });

    if (!purchaseOrder) {
      const vendor = await tx.vendor.findFirst({
        where: { id: vendorId, companyId },
        select: { id: true, code: true, poSequence: true }
      });
      if (!vendor) {
        skipped.push({ rawSkuId: items[0].rawSkuId, reason: "Vendor not found" });
        continue;
      }
      const nextSeq = vendor.poSequence + 1;
      await tx.vendor.update({ where: { id: vendor.id }, data: { poSequence: nextSeq } });
      purchaseOrder = await tx.purchaseOrder.create({
        data: {
          companyId,
          vendorId,
          poNumber: `PO-${vendor.code}-${String(nextSeq).padStart(4, "0")}`,
          status: "DRAFT",
          orderDate: new Date(),
          currency: "INR",
          notes: `Auto-drafted for Sales Order ${soNumber ?? salesOrderId}`
        },
        select: { id: true, poNumber: true }
      });
      createdPoIds.push(purchaseOrder.id);
    }

    for (const item of items) {
      const poLine = await tx.purchaseOrderLine.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          skuId: item.rawSkuId,
          description: `Auto-draft for Sales Order ${soNumber ?? salesOrderId}`,
          quantity: item.shortageQty,
          unitPrice: item.unitPrice,
          discountPct: 0,
          taxPct: 0,
          qcStatus: "PENDING"
        }
      });
      createdLines += 1;

      let remaining = item.shortageQty;
      for (const line of availability.lines) {
        if (remaining <= 0) break;
        const rawNeed = line.rawNeeds.find((need) => need.rawSkuId === item.rawSkuId);
        if (!rawNeed) continue;
        const lineAllocMap = allocatedByLineRaw.get(line.lineId) ?? new Map();
        const alreadyAllocated = lineAllocMap.get(item.rawSkuId) ?? 0;
        const lineShortage = Math.max(rawNeed.requiredQty - alreadyAllocated, 0);
        if (lineShortage <= 0) continue;
        const allocateQty = Math.min(lineShortage, remaining);
        remaining -= allocateQty;
        lineAllocMap.set(item.rawSkuId, alreadyAllocated + allocateQty);
        allocatedByLineRaw.set(line.lineId, lineAllocMap);

        await tx.purchaseOrderAllocation.create({
          data: {
            poLineId: poLine.id,
            soLineId: line.lineId,
            quantity: allocateQty
          }
        });
      }
    }
  }

  return {
    createdPoIds,
    createdLines,
    skipped
  };
}
