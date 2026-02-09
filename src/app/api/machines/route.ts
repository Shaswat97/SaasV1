import { prisma } from "@/lib/prisma";
import { machineSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId();

  const machines = await prisma.machine.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(machines);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = machineSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const machine = await prisma.machine.create({
      data: {
        companyId,
        ...parsed.data
      }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Machine",
      entityId: machine.id,
      summary: `Created machine ${machine.code} · ${machine.name}.`
    });

    return jsonOk(machine, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Machine code already exists", 409);
    }
    throw error;
  }
}
