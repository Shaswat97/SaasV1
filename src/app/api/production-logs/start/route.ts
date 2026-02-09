import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { recordStockMovement } from "@/lib/stock-service";
import { releaseRawReservationForLine } from "@/lib/sales-order";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const crewSchema = z.object({
  employeeId: z.string().min(1, "Crew member is required"),
  role: z.enum(["OPERATOR", "SUPERVISOR", "HELPER"]),
  startAt: z.string().datetime().optional()
});

const startSchema = z.object({
  purpose: z.enum(["ORDER", "STOCK"]),
  salesOrderLineId: z.string().optional(),
  finishedSkuId: z.string().optional(),
  machineId: z.string().min(1, "Machine is required"),
  operatorId: z.string().optional(),
  supervisorId: z.string().optional(),
  crewSize: z.number().int().positive().optional(),
  crew: z.array(crewSchema).optional(),
  plannedQty: z.number().positive("Planned quantity must be greater than 0"),
  startAt: z.string().datetime().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = startSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const data = parsed.data;
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  if (data.purpose === "ORDER" && !data.salesOrderLineId) {
    return jsonError("Sales order line is required for order production");
  }

  if (data.purpose === "STOCK" && !data.finishedSkuId) {
    return jsonError("Finished SKU is required for stock build");
  }

  const machine = await prisma.machine.findFirst({
    where: { id: data.machineId, companyId, deletedAt: null }
  });
  if (!machine) return jsonError("Machine not found", 404);

  const crewEmployeeIds = new Set<string>();
  if (data.operatorId) crewEmployeeIds.add(data.operatorId);
  if (data.supervisorId) crewEmployeeIds.add(data.supervisorId);
  if (data.crew?.length) data.crew.forEach((entry) => crewEmployeeIds.add(entry.employeeId));

  if (crewEmployeeIds.size) {
    const crewEmployees = await prisma.employee.findMany({
      where: { id: { in: Array.from(crewEmployeeIds) }, companyId, deletedAt: null },
      select: { id: true }
    });
    if (crewEmployees.length !== crewEmployeeIds.size) {
      return jsonError("One or more crew members are invalid", 400);
    }
  }

  const { finishedSkuId, salesOrderLineId } = await prisma.$transaction(async (tx) => {
    if (data.purpose === "ORDER" && data.salesOrderLineId) {
      const line = await tx.salesOrderLine.findFirst({
        where: { id: data.salesOrderLineId, salesOrder: { companyId, deletedAt: null } },
        include: { sku: true }
      });
      if (!line) throw new Error("Sales order line not found");
      if (line.sku.type !== "FINISHED") throw new Error("Sales order line must reference a finished SKU");
      return { finishedSkuId: line.skuId, salesOrderLineId: line.id };
    }

    const sku = await tx.sku.findFirst({
      where: { id: data.finishedSkuId ?? "", companyId, deletedAt: null }
    });
    if (!sku) throw new Error("Finished SKU not found");
    if (sku.type !== "FINISHED") throw new Error("Production can only build finished SKUs");
    return { finishedSkuId: sku.id, salesOrderLineId: undefined };
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const startAt = data.startAt ? new Date(data.startAt) : new Date();
      const operatorId = data.operatorId ?? data.crew?.find((entry) => entry.role === "OPERATOR")?.employeeId;
      const supervisorId = data.supervisorId ?? data.crew?.find((entry) => entry.role === "SUPERVISOR")?.employeeId;
      const log = await tx.productionLog.create({
        data: {
          companyId,
          purpose: data.purpose,
          status: "OPEN",
          salesOrderLineId,
          finishedSkuId,
          machineId: data.machineId,
          operatorId,
          supervisorId,
          crewSize: data.crewSize,
          plannedQty: data.plannedQty,
          startAt,
          notes: data.notes
        }
      });

      if (data.crew?.length) {
        await tx.productionLogCrew.createMany({
          data: data.crew.map((entry) => ({
            companyId,
            logId: log.id,
            employeeId: entry.employeeId,
            role: entry.role,
            startAt: entry.startAt ? new Date(entry.startAt) : startAt
          }))
        });
      }

      const zones = await tx.zone.findMany({
        where: { companyId, deletedAt: null, type: { in: ["RAW_MATERIAL", "PROCESSING_WIP"] } }
      });
      const rawZone = zones.find((zone) => zone.type === "RAW_MATERIAL");
      const wipZone = zones.find((zone) => zone.type === "PROCESSING_WIP");
      if (!rawZone || !wipZone) {
        throw new Error("Raw and WIP zones must exist before starting production");
      }

      const bom = await tx.bom.findFirst({
        where: { companyId, finishedSkuId, deletedAt: null },
        include: { lines: { include: { rawSku: true } } },
        orderBy: { version: "desc" }
      });

      let totalRawCost = 0;
      if (bom?.lines?.length) {
        for (const line of bom.lines) {
          if (line.rawSku.type !== "RAW") {
            throw new Error("BOM must reference raw SKUs");
          }
          const quantity = data.plannedQty * line.quantity;
          if (quantity <= 0) continue;
          if (salesOrderLineId) {
            await releaseRawReservationForLine({
              soLineId: salesOrderLineId,
              skuId: line.rawSkuId,
              quantity,
              tx
            });
          }
          const movement = await recordStockMovement(
            {
              companyId,
              skuId: line.rawSkuId,
              zoneId: rawZone.id,
              quantity,
              direction: "OUT",
              movementType: "ISSUE",
              referenceType: "PROD_LOG",
              referenceId: log.id,
              notes: "Raw consumed for production start"
            },
            tx
          );
          totalRawCost += movement.totalCost;
        }
      }

      const costPerUnit = data.plannedQty > 0 ? totalRawCost / data.plannedQty : 0;

      await recordStockMovement(
        {
          companyId,
          skuId: finishedSkuId,
          zoneId: wipZone.id,
          quantity: data.plannedQty,
          direction: "IN",
          movementType: "PRODUCE",
          costPerUnit,
          referenceType: "PROD_LOG",
          referenceId: log.id,
          notes: "WIP started"
        },
        tx
      );

      return tx.productionLog.findUnique({
        where: { id: log.id },
        include: {
          finishedSku: true,
          machine: true,
          operator: true,
          supervisor: true,
          salesOrderLine: {
            include: {
              salesOrder: { include: { customer: true } },
              sku: true
            }
          }
        }
      });
    });

    if (result) {
      await recordActivity({
        companyId,
        actorName,
        actorEmployeeId,
        action: "CREATE",
        entityType: "Production Log",
        entityId: result.id,
        summary: `Started production log for ${result.finishedSku?.code ?? "finished SKU"}.`
      });
    }

    return jsonOk(result, { status: 201 });
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to start production log");
  }
}
