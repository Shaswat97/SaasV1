import { getTenantPrisma } from "@/lib/tenant-prisma";
import { skuSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const skuType = "FINISHED" as const;

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId(prisma);

  const skus = await prisma.sku.findMany({
    where: {
      companyId,
      type: skuType,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(skus);
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

  const parsed = skuSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  if (parsed.data.preferredVendorId) {
    return jsonError("Finished SKUs cannot have a preferred vendor", 400);
  }

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const sku = await prisma.sku.create({
      data: {
        companyId,
        type: skuType,
        ...parsed.data
      }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Finished SKU",
      entityId: sku.id,
      summary: `Created finished SKU ${sku.code} · ${sku.name}.`
    });

    return jsonOk(sku, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("SKU code already exists", 409);
    }
    throw error;
  }
}
