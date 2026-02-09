import { prisma } from "@/lib/prisma";
import { machineSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const machine = await prisma.machine.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!machine) return jsonError("Machine not found", 404);

  return jsonOk(machine);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = machineSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const existing = await prisma.machine.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Machine not found", 404);

  try {
    const machine = await prisma.machine.update({
      where: { id: params.id },
      data: { ...parsed.data }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Machine",
      entityId: machine.id,
      summary: `Updated machine ${machine.code} · ${machine.name}.`
    });

    return jsonOk(machine);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Machine code already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.machine.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Machine not found", 404);

  const machine = await prisma.machine.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Machine",
    entityId: machine.id,
    summary: `Deleted machine ${machine.code} · ${machine.name}.`
  });

  return jsonOk(machine);
}
