import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { recordStockMovement } from "@/lib/stock-service";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const closeSchema = z.object({
  goodQty: z.number().min(0),
  rejectQty: z.number().min(0),
  scrapQty: z.number().min(0),
  closeAt: z.string().datetime().optional(),
  closeNotes: z.string().optional(),
  rawConsumptions: z
    .array(
      z.object({
        rawSkuId: z.string().min(1),
        batchId: z.string().optional(),
        quantity: z.number().min(0),
        bomQty: z.number().min(0).optional()
      })
    )
    .optional(),
  crew: z
    .array(
      z.object({
        crewId: z.string().min(1),
        endAt: z.string().datetime().optional()
      })
    )
    .optional()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = closeSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const data = parsed.data;

  const log = await prisma.productionLog.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { salesOrderLine: true }
  });

  if (!log) return jsonError("Production log not found", 404);
  if (log.status !== "OPEN") return jsonError("Only open logs can be closed", 400);

  const totalQty = data.goodQty + data.rejectQty + data.scrapQty;
  if (data.goodQty <= 0) return jsonError("Good quantity must be greater than 0", 400);
  if (totalQty <= 0) return jsonError("Total output must be greater than 0", 400);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const zones = await tx.zone.findMany({
        where: { companyId, deletedAt: null, type: { in: ["PROCESSING_WIP", "PRODUCTION", "WIP", "FINISHED", "SCRAP"] } }
      });
      const wipZone = zones.find((zone) => ["PROCESSING_WIP", "PRODUCTION", "WIP"].includes(zone.type));
      const finishedZone = zones.find((zone) => zone.type === "FINISHED");
      const scrapZone = zones.find((zone) => zone.type === "SCRAP");
      if (!wipZone || !finishedZone || !scrapZone) {
        throw new Error("WIP, Finished, and Scrap zones must exist before closing production");
      }

      const wipBalance = await tx.stockBalance.findUnique({
        where: { companyId_skuId_zoneId: { companyId, skuId: log.finishedSkuId, zoneId: wipZone.id } }
      });

      const wipCost = wipBalance?.costPerUnit ?? 0;
      const wipQtyOnHand = wipBalance?.quantityOnHand ?? 0;
      if (totalQty > wipQtyOnHand) {
        const topUpQty = totalQty - wipQtyOnHand;
        await recordStockMovement(
          {
            companyId,
            skuId: log.finishedSkuId,
            zoneId: wipZone.id,
            quantity: topUpQty,
            direction: "IN",
            movementType: "ADJUSTMENT",
            costPerUnit: wipCost,
            referenceType: "PROD_LOG",
            referenceId: log.id,
            notes: "WIP top-up for extra reject/scrap output"
          },
          tx
        );
      }

      await recordStockMovement(
        {
          companyId,
          skuId: log.finishedSkuId,
          zoneId: wipZone.id,
          quantity: totalQty,
          direction: "OUT",
          movementType: "PRODUCE",
          referenceType: "PROD_LOG",
          referenceId: log.id,
          notes: "WIP closed"
        },
        tx
      );

      if (data.goodQty > 0) {
        await recordStockMovement(
          {
            companyId,
            skuId: log.finishedSkuId,
            zoneId: finishedZone.id,
            quantity: data.goodQty,
            direction: "IN",
            movementType: "PRODUCE",
            costPerUnit: wipCost,
            referenceType: "PROD_LOG",
            referenceId: log.id,
            notes: "Finished goods produced"
          },
          tx
        );
      }

      const scrapTotal = data.rejectQty + data.scrapQty;
      if (scrapTotal > 0) {
        await recordStockMovement(
          {
            companyId,
            skuId: log.finishedSkuId,
            zoneId: scrapZone.id,
            quantity: scrapTotal,
            direction: "IN",
            movementType: "PRODUCE",
            costPerUnit: wipCost,
            referenceType: "PROD_LOG",
            referenceId: log.id,
            notes: "Rejects/scrap"
          },
          tx
        );
      }

      const cumulativeGood = (log.goodQty ?? 0) + data.goodQty;
      const cumulativeReject = (log.rejectQty ?? 0) + data.rejectQty;
      const cumulativeScrap = (log.scrapQty ?? 0) + data.scrapQty;
      const remainingAfter = Math.max(log.plannedQty - cumulativeGood, 0);
      const oeePct = log.plannedQty > 0 ? (cumulativeGood / log.plannedQty) * 100 : null;

      const closeMoment = data.closeAt ? new Date(data.closeAt) : new Date();
      const crewRows = await tx.productionLogCrew.findMany({
        where: { logId: log.id }
      });

      if (data.crew?.length) {
        const crewMap = new Map(crewRows.map((row) => [row.id, row]));
        for (const entry of data.crew) {
          const crewRow = crewMap.get(entry.crewId);
          if (!crewRow) continue;
          const endAt = entry.endAt ? new Date(entry.endAt) : closeMoment;
          if (endAt < crewRow.startAt) {
            throw new Error("Crew end time cannot be before start time");
          }
          await tx.productionLogCrew.update({
            where: { id: crewRow.id },
            data: { endAt }
          });
        }
      }

      const openCrew = crewRows.filter((row) => !row.endAt);
      for (const row of openCrew) {
        await tx.productionLogCrew.update({
          where: { id: row.id },
          data: { endAt: closeMoment }
        });
      }

      if (log.salesOrderLineId) {
        await tx.salesOrderLine.update({
          where: { id: log.salesOrderLineId },
          data: {
            producedQty: { increment: data.goodQty },
            scrapQty: { increment: scrapTotal }
          }
        });
      }

      if (data.rawConsumptions?.length) {
        const consumptionKeySet = new Set(
          data.rawConsumptions.map((entry) => `${entry.rawSkuId}:${entry.batchId ?? "NO_BATCH"}`)
        );
        if (consumptionKeySet.size !== data.rawConsumptions.length) {
          throw new Error("Duplicate raw SKU batch rows are not allowed in raw consumption");
        }
        const rawSkuIds = data.rawConsumptions.map((entry) => entry.rawSkuId);
        const rawSkus = await tx.sku.findMany({
          where: { id: { in: rawSkuIds }, companyId, deletedAt: null }
        });
        if (rawSkus.length !== rawSkuIds.length) {
          throw new Error("One or more raw SKUs are invalid");
        }
        if (rawSkus.some((sku) => sku.type !== "RAW")) {
          throw new Error("Raw consumption must reference RAW SKUs");
        }

        const previousConsumptions = await tx.productionLogConsumption.findMany({
          where: { logId: log.id }
        });

        const batchIds = Array.from(
          new Set(data.rawConsumptions.map((entry) => entry.batchId).filter(Boolean) as string[])
        );
        const batchRows = batchIds.length
          ? await tx.rawMaterialBatch.findMany({
              where: { id: { in: batchIds }, companyId }
            })
          : [];
        const batchMap = new Map(batchRows.map((row) => [row.id, row]));
        if (batchRows.length !== batchIds.length) {
          throw new Error("One or more selected batches are invalid");
        }

        data.rawConsumptions.forEach((entry) => {
          if (!entry.batchId) return;
          const batch = batchMap.get(entry.batchId);
          if (!batch || batch.skuId !== entry.rawSkuId) {
            throw new Error("Selected batch does not belong to the selected raw SKU");
          }
        });

        const hasUnbatchedInput = data.rawConsumptions.some((entry) => !entry.batchId);
        if (!hasUnbatchedInput) {
          const prevByBatch = new Map<string, number>();
          previousConsumptions.forEach((entry) => {
            if (!entry.batchId) return;
            prevByBatch.set(entry.batchId, (prevByBatch.get(entry.batchId) ?? 0) + entry.quantity);
          });
          const nextByBatch = new Map<string, number>();
          data.rawConsumptions.forEach((entry) => {
            if (!entry.batchId) return;
            nextByBatch.set(entry.batchId, (nextByBatch.get(entry.batchId) ?? 0) + entry.quantity);
          });
          const affectedBatchIds = new Set<string>([...prevByBatch.keys(), ...nextByBatch.keys()]);
          for (const batchId of affectedBatchIds) {
            const prevQty = prevByBatch.get(batchId) ?? 0;
            const nextQty = nextByBatch.get(batchId) ?? 0;
            const delta = nextQty - prevQty;
            if (Math.abs(delta) < 0.0001) continue;
            const batch = batchMap.get(batchId) ?? (await tx.rawMaterialBatch.findUnique({ where: { id: batchId } }));
            if (!batch) throw new Error("Batch not found");
            if (delta > 0) {
              if (batch.quantityRemaining < delta) {
                throw new Error(`Insufficient quantity in batch ${batch.batchNumber}`);
              }
              await tx.rawMaterialBatch.update({
                where: { id: batchId },
                data: { quantityRemaining: { decrement: delta } }
              });
            } else {
              await tx.rawMaterialBatch.update({
                where: { id: batchId },
                data: { quantityRemaining: { increment: Math.abs(delta) } }
              });
            }
          }
        }

        await tx.productionLogConsumption.deleteMany({ where: { logId: log.id } });
        await tx.productionLogConsumption.createMany({
          data: data.rawConsumptions.map((entry) => ({
            companyId,
            logId: log.id,
            rawSkuId: entry.rawSkuId,
            batchId: entry.batchId ?? null,
            quantity: entry.quantity,
            bomQty: entry.bomQty ?? null,
            costPerUnit: entry.batchId ? (batchMap.get(entry.batchId)?.costPerUnit ?? null) : null
          }))
        });
      }

      let expectedRawQty: number | null = null;
      let actualRawQty: number | null = null;
      let expectedRawCost: number | null = null;
      let actualRawCost: number | null = null;
      let materialVariancePct: number | null = null;
      let materialVarianceCost: number | null = null;

      if (remainingAfter === 0) {
        const issuedRows = await tx.stockLedger.findMany({
          where: {
            companyId,
            referenceType: "PROD_LOG",
            referenceId: log.id,
            movementType: "ISSUE",
            direction: "OUT"
          }
        });

        const issuedMap = new Map<string, { qty: number; costTotal: number }>();
        issuedRows.forEach((row) => {
          const current = issuedMap.get(row.skuId) ?? { qty: 0, costTotal: 0 };
          issuedMap.set(row.skuId, {
            qty: current.qty + row.quantity,
            costTotal: current.costTotal + row.totalCost
          });
        });

        const issuedTotals = Array.from(issuedMap.values()).reduce(
          (sum, entry) => {
            sum.qty += entry.qty;
            sum.cost += entry.costTotal;
            return sum;
          },
          { qty: 0, cost: 0 }
        );

        const actualMap = new Map<string, number>();
        if (data.rawConsumptions?.length) {
          data.rawConsumptions.forEach((entry) => {
            actualMap.set(entry.rawSkuId, (actualMap.get(entry.rawSkuId) ?? 0) + entry.quantity);
          });
        } else {
          issuedMap.forEach((entry, skuId) => {
            actualMap.set(skuId, entry.qty);
          });
        }

        actualRawQty = Array.from(actualMap.values()).reduce((sum, qty) => sum + qty, 0);
        if (data.rawConsumptions?.length) {
          const batchIds = Array.from(
            new Set(data.rawConsumptions.map((entry) => entry.batchId).filter(Boolean) as string[])
          );
          const batchRows = batchIds.length
            ? await tx.rawMaterialBatch.findMany({ where: { id: { in: batchIds }, companyId } })
            : [];
          const batchCostMap = new Map(batchRows.map((row) => [row.id, row.costPerUnit]));
          actualRawCost = data.rawConsumptions.reduce((sum, entry) => {
            if (entry.batchId) {
              return sum + entry.quantity * (batchCostMap.get(entry.batchId) ?? 0);
            }
            const issued = issuedMap.get(entry.rawSkuId);
            const issuedCpu = issued && issued.qty > 0 ? issued.costTotal / issued.qty : 0;
            return sum + entry.quantity * issuedCpu;
          }, 0);
        }

        let adjustmentCostDelta = 0;
        if (data.rawConsumptions?.length) {
          const rawZone = await tx.zone.findFirst({
            where: { companyId, deletedAt: null, type: "RAW_MATERIAL" }
          });
          if (!rawZone) {
            throw new Error("Raw material zone not found");
          }

          const skuIds = new Set<string>([...issuedMap.keys(), ...actualMap.keys()]);
          for (const skuId of skuIds) {
            const issued = issuedMap.get(skuId) ?? { qty: 0, costTotal: 0 };
            const actual = actualMap.get(skuId) ?? issued.qty;
            const diff = actual - issued.qty;
            if (Math.abs(diff) < 0.0001) continue;
            const issuedCostPerUnit = issued.qty > 0 ? issued.costTotal / issued.qty : undefined;
            if (diff > 0) {
              const movement = await recordStockMovement(
                {
                  companyId,
                  skuId,
                  zoneId: rawZone.id,
                  quantity: diff,
                  direction: "OUT",
                  movementType: "ADJUSTMENT",
                  referenceType: "PROD_LOG",
                  referenceId: log.id,
                  notes: "Raw consumption adjustment"
                },
                tx
              );
              adjustmentCostDelta += movement.totalCost;
            } else {
              const movement = await recordStockMovement(
                {
                  companyId,
                  skuId,
                  zoneId: rawZone.id,
                  quantity: Math.abs(diff),
                  direction: "IN",
                  movementType: "ADJUSTMENT",
                  costPerUnit: issuedCostPerUnit,
                  referenceType: "PROD_LOG",
                  referenceId: log.id,
                  notes: "Raw consumption adjustment"
                },
                tx
              );
              adjustmentCostDelta -= movement.totalCost;
            }
          }
        }

        const scale = log.plannedQty > 0 ? cumulativeGood / log.plannedQty : 0;
        expectedRawQty = issuedTotals.qty * scale;
        expectedRawCost = issuedTotals.cost * scale;
        if (actualRawCost == null) {
          actualRawCost = issuedTotals.cost + adjustmentCostDelta;
        }
        materialVarianceCost = expectedRawCost > 0 ? actualRawCost - expectedRawCost : null;
        materialVariancePct =
          expectedRawCost && expectedRawCost > 0
            ? (actualRawCost - expectedRawCost) / expectedRawCost * 100
            : expectedRawQty && expectedRawQty > 0
              ? ((actualRawQty ?? 0) - expectedRawQty) / expectedRawQty * 100
              : null;
      }

      const updated = await tx.productionLog.update({
        where: { id: log.id },
        data: {
          status: "CLOSED",
          closeAt: closeMoment,
          goodQty: cumulativeGood,
          rejectQty: cumulativeReject,
          scrapQty: cumulativeScrap,
          oeePct,
          closeNotes: data.closeNotes ?? log.closeNotes,
          ...(remainingAfter === 0
            ? {
                expectedRawQty,
                actualRawQty,
                expectedRawCost,
                actualRawCost,
                materialVariancePct,
                materialVarianceCost
              }
            : {})
        },
        include: {
          finishedSku: true,
          machine: true,
          operator: true,
          supervisor: true,
          salesOrderLine: { include: { salesOrder: { include: { customer: true } }, sku: true } }
        }
      });

      if (remainingAfter === 0 && log.salesOrderLineId && expectedRawCost !== null && actualRawCost !== null) {
        await tx.salesOrderLine.update({
          where: { id: log.salesOrderLineId },
          data: {
            expectedRawCost: { increment: expectedRawCost },
            actualRawCost: { increment: actualRawCost }
          }
        });
      }

      return updated;
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Production Log",
      entityId: result.id,
      summary: `Closed production log ${result.id} with ${data.goodQty} good.`
    });

    return jsonOk(result);
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to close production log");
  }
}
