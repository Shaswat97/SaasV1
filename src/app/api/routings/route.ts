import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const stepSchema = z.object({
  sequence: z.number().int().positive("Step sequence must be positive"),
  machineId: z.string().min(1, "Machine is required"),
  capacityPerMinute: z.number().positive("Capacity per minute must be positive")
});

const routingSchema = z.object({
  finishedSkuId: z.string().min(1, "Finished SKU is required"),
  name: z.string().optional(),
  steps: z.array(stepSchema).min(1, "At least one routing step is required")
});

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const pending = await prisma.machineSku.findMany({
    where: {
      companyId,
      deletedAt: null,
      sku: { type: "FINISHED", deletedAt: null, routing: { is: null } }
    },
    select: { skuId: true, machineId: true, capacityPerMinute: true }
  });

  if (pending.length) {
    const bySku = new Map<string, Array<{ machineId: string; capacityPerMinute: number }>>();
    pending.forEach((row) => {
      const list = bySku.get(row.skuId) ?? [];
      list.push({ machineId: row.machineId, capacityPerMinute: row.capacityPerMinute });
      bySku.set(row.skuId, list);
    });

    await prisma.$transaction(async (tx) => {
      for (const [skuId, options] of bySku.entries()) {
        const best = options.reduce((acc, curr) =>
          curr.capacityPerMinute > acc.capacityPerMinute ? curr : acc
        );
        const created = await tx.routing.create({
          data: {
            companyId,
            finishedSkuId: skuId,
            name: "Auto-converted from machine mapping"
          }
        });
        await tx.routingStep.create({
          data: {
            routingId: created.id,
            machineId: best.machineId,
            sequence: 1,
            capacityPerMinute: best.capacityPerMinute,
            active: true
          }
        });
      }
    });

    await recordActivity({
      companyId,
      actorName: actorName ?? "System",
      actorEmployeeId: actorEmployeeId ?? null,
      action: "UPDATE",
      entityType: "Routing",
      entityId: null,
      summary: `Auto-converted ${bySku.size} machine mappings into single-step routings.`
    });
  }

  const routings = await prisma.routing.findMany({
    where: { companyId, deletedAt: null },
    include: {
      steps: { include: { machine: true }, orderBy: { sequence: "asc" } }
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(routings);
}

export async function POST(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = routingSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const finishedSku = await prisma.sku.findFirst({
    where: { id: parsed.data.finishedSkuId, companyId, type: "FINISHED", deletedAt: null }
  });
  if (!finishedSku) return jsonError("Finished SKU not found", 404);

  const existing = await prisma.routing.findFirst({
    where: { companyId, finishedSkuId: finishedSku.id, deletedAt: null }
  });
  if (existing) return jsonError("Routing already exists for this SKU", 409);

  const machineIds = parsed.data.steps.map((step) => step.machineId);
  const machines = await prisma.machine.findMany({
    where: { id: { in: machineIds }, companyId, deletedAt: null }
  });
  if (machines.length !== machineIds.length) {
    return jsonError("One or more machines are invalid", 400);
  }

  const routing = await prisma.$transaction(async (tx) => {
    const created = await tx.routing.create({
      data: {
        companyId,
        finishedSkuId: finishedSku.id,
        name: parsed.data.name
      }
    });

    await tx.routingStep.createMany({
      data: parsed.data.steps.map((step) => ({
        routingId: created.id,
        machineId: step.machineId,
        sequence: step.sequence,
        capacityPerMinute: step.capacityPerMinute,
        active: true
      }))
    });

    return created;
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Routing",
    entityId: routing.id,
    summary: `Created routing for ${finishedSku.code} · ${finishedSku.name}.`
  });

  return jsonOk(routing, { status: 201 });
}
