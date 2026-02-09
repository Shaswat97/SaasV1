import { prisma } from "@/lib/prisma";
import { machineSkuSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId();

  const machineSkus = await prisma.machineSku.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    include: {
      machine: true,
      sku: true
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(machineSkus);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = machineSkuSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const machine = await prisma.machine.findFirst({
    where: { id: parsed.data.machineId, companyId, deletedAt: null }
  });

  if (!machine) return jsonError("Machine not found", 404);

  const sku = await prisma.sku.findFirst({
    where: { id: parsed.data.skuId, companyId, deletedAt: null }
  });

  if (!sku) return jsonError("SKU not found", 404);
  if (sku.type !== "FINISHED") return jsonError("MachineSku requires a finished SKU", 400);

  try {
    const machineSku = await prisma.machineSku.create({
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
      entityType: "Machine SKU",
      entityId: machineSku.id,
      summary: "Created machine SKU mapping."
    });

    return jsonOk(machineSku, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Machine SKU already exists", 409);
    }
    throw error;
  }
}
