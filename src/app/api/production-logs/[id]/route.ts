import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const log = await prisma.productionLog.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!log) return jsonError("Production log not found", 404);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.productionLog.update({
      where: { id: log.id },
      data: {
        status: "CANCELLED",
        deletedAt: new Date()
      }
    });

    await tx.productionLogAudit.create({
      data: {
        companyId,
        logId: log.id,
        action: "CANCEL",
        reason: typeof payload?.reason === "string" ? payload.reason : undefined
      }
    });

    return next;
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Production Log",
    entityId: updated.id,
    summary: `Cancelled production log ${updated.id}.`
  });

  return jsonOk(updated);
}
