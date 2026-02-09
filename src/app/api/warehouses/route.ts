import { prisma } from "@/lib/prisma";
import { warehouseSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId();

  const warehouses = await prisma.warehouse.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(warehouses);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = warehouseSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const warehouse = await prisma.warehouse.create({
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
      entityType: "Warehouse",
      entityId: warehouse.id,
      summary: `Created warehouse ${warehouse.code} · ${warehouse.name}.`
    });

    return jsonOk(warehouse, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Warehouse code already exists", 409);
    }
    throw error;
  }
}
