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

const routingUpdateSchema = z.object({
  name: z.string().optional(),
  steps: z.array(stepSchema).min(1, "At least one routing step is required")
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = routingUpdateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const routing = await prisma.routing.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { finishedSku: true }
  });
  if (!routing) return jsonError("Routing not found", 404);

  const machineIds = parsed.data.steps.map((step) => step.machineId);
  const machines = await prisma.machine.findMany({
    where: { id: { in: machineIds }, companyId, deletedAt: null }
  });
  if (machines.length !== machineIds.length) {
    return jsonError("One or more machines are invalid", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.routing.update({
      where: { id: routing.id },
      data: { name: parsed.data.name }
    });
    await tx.routingStep.deleteMany({ where: { routingId: routing.id } });
    await tx.routingStep.createMany({
      data: parsed.data.steps.map((step) => ({
        routingId: routing.id,
        machineId: step.machineId,
        sequence: step.sequence,
        capacityPerMinute: step.capacityPerMinute,
        active: true
      }))
    });
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Routing",
    entityId: routing.id,
    summary: `Updated routing for ${routing.finishedSku.code} · ${routing.finishedSku.name}.`
  });

  return jsonOk({ updated: true });
}
