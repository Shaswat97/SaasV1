import { getTenantPrisma } from "@/lib/tenant-prisma";
import { machineSkuSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const machineSku = await prisma.machineSku.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { machine: true, sku: true }
  });

  if (!machineSku) return jsonError("Machine SKU not found", 404);

  return jsonOk(machineSku);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = machineSkuSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const existing = await prisma.machineSku.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Machine SKU not found", 404);

  if (parsed.data.machineId) {
    const machine = await prisma.machine.findFirst({
      where: { id: parsed.data.machineId, companyId, deletedAt: null }
    });

    if (!machine) return jsonError("Machine not found", 404);
  }

  if (parsed.data.skuId) {
    const sku = await prisma.sku.findFirst({
      where: { id: parsed.data.skuId, companyId, deletedAt: null }
    });

    if (!sku) return jsonError("SKU not found", 404);
    if (sku.type !== "FINISHED") return jsonError("MachineSku requires a finished SKU", 400);
  }

  try {
    const machineSku = await prisma.machineSku.update({
      where: { id: params.id },
      data: { ...parsed.data }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Machine SKU",
      entityId: machineSku.id,
      summary: "Updated machine SKU mapping."
    });

    return jsonOk(machineSku);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Machine SKU already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.machineSku.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Machine SKU not found", 404);

  const machineSku = await prisma.machineSku.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Machine SKU",
    entityId: machineSku.id,
    summary: "Deleted machine SKU mapping."
  });

  return jsonOk(machineSku);
}
