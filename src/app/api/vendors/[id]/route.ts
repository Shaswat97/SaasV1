import { getTenantPrisma } from "@/lib/tenant-prisma";
import { vendorSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { toAddressFields } from "@/lib/address";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const vendor = await prisma.vendor.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: {
      _count: {
        select: { rawSkus: true }
      }
    }
  });

  if (!vendor) return jsonError("Vendor not found", 404);

  return jsonOk(vendor);
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

  const parsed = vendorSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { billingAddress, shippingAddress, ...data } = parsed.data;
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.vendor.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Vendor not found", 404);

  try {
    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: {
        ...data,
        ...toAddressFields("billing", billingAddress),
        ...toAddressFields("shipping", shippingAddress)
      }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Vendor",
      entityId: vendor.id,
      summary: `Updated vendor ${vendor.code} · ${vendor.name}.`
    });

    return jsonOk(vendor);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Vendor code already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.vendor.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Vendor not found", 404);

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Vendor",
    entityId: vendor.id,
    summary: `Deleted vendor ${vendor.code} · ${vendor.name}.`
  });

  return jsonOk(vendor);
}
