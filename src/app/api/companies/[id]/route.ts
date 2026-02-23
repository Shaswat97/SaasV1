import { getTenantPrisma } from "@/lib/tenant-prisma";
import { companySchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { toAddressFields } from "@/lib/address";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const company = await prisma.company.findFirst({
    where: { id: params.id, deletedAt: null }
  });

  if (!company) return jsonError("Company not found", 404);

  return jsonOk(company);
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

  const parsed = companySchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { billingAddress, shippingAddress, ...data } = parsed.data;
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const company = await prisma.company.update({
      where: { id: params.id },
      data: {
        ...data,
        ...toAddressFields("billing", billingAddress),
        ...toAddressFields("shipping", shippingAddress)
      }
    });

    await recordActivity({
      companyId: company.id,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Company",
      entityId: company.id,
      summary: `Updated company ${company.name}.`
    });

    return jsonOk(company);
  } catch {
    return jsonError("Company not found", 404);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  try {
    const company = await prisma.company.update({
      where: { id: params.id },
      data: { deletedAt: new Date() }
    });

    await recordActivity({
      companyId: company.id,
      actorName,
      actorEmployeeId,
      action: "DELETE",
      entityType: "Company",
      entityId: company.id,
      summary: `Deleted company ${company.name}.`
    });

    return jsonOk(company);
  } catch {
    return jsonError("Company not found", 404);
  }
}
