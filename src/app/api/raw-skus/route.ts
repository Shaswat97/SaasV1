import { prisma } from "@/lib/prisma";
import { skuSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const skuType = "RAW" as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const skus = await prisma.sku.findMany({
    where: {
      companyId,
      type: skuType,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    include: {
      preferredVendor: true
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(skus);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = skuSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  if (parsed.data.scrapPct === undefined) {
    return jsonError("scrapPct is required for raw SKUs", 400);
  }

  const companyId = await getDefaultCompanyId();

  if (parsed.data.preferredVendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: parsed.data.preferredVendorId, companyId, deletedAt: null }
    });

    if (!vendor) return jsonError("Preferred vendor not found", 404);
  }

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
      entityType: "Raw SKU",
      entityId: sku.id,
      summary: `Created raw SKU ${sku.code} · ${sku.name}.`
    });

    return jsonOk(sku, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("SKU code already exists", 409);
    }
    throw error;
  }
}
