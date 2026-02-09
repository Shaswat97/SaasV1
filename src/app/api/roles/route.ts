import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { roleNameSchema } from "@/lib/validation";
import { z } from "zod";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const rolePayloadSchema = z.object({ name: roleNameSchema });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId();

  const roles = await prisma.role.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    orderBy: { createdAt: "asc" }
  });

  return jsonOk(roles);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = rolePayloadSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const role = await prisma.role.create({
      data: {
        companyId,
        name: parsed.data.name
      }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Role",
      entityId: role.id,
      summary: `Created role ${role.name}.`
    });

    return jsonOk(role, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Role already exists", 409);
    }
    throw error;
  }
}
