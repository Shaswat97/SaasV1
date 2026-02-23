import { getTenantPrisma } from "@/lib/tenant-prisma";
import { zoneSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId(prisma);

  const zones = await prisma.zone.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    include: { warehouse: true },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(zones);
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

  const parsed = zoneSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: parsed.data.warehouseId, companyId, deletedAt: null }
  });

  if (!warehouse) return jsonError("Warehouse not found", 404);

  try {
    const zone = await prisma.zone.create({
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
      entityType: "Zone",
      entityId: zone.id,
      summary: `Created zone ${zone.code} · ${zone.name}.`
    });

    return jsonOk(zone, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Zone code already exists", 409);
    }
    throw error;
  }
}
