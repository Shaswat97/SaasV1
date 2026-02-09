import { prisma } from "@/lib/prisma";
import { vendorSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { toAddressFields } from "@/lib/address";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId();

  const vendors = await prisma.vendor.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    include: {
      _count: {
        select: { vendorSkus: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(vendors);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = vendorSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { billingAddress, shippingAddress, ...data } = parsed.data;
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const vendor = await prisma.vendor.create({
      data: {
        companyId,
        ...data,
        ...toAddressFields("billing", billingAddress),
        ...toAddressFields("shipping", shippingAddress)
      }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Vendor",
      entityId: vendor.id,
      summary: `Created vendor ${vendor.code} · ${vendor.name}.`
    });

    return jsonOk(vendor, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Vendor code already exists", 409);
    }
    throw error;
  }
}
