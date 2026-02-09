import { getTenantPrisma } from "@/lib/tenant-prisma";
import { customerSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { toAddressFields } from "@/lib/address";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const customer = await prisma.customer.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!customer) return jsonError("Customer not found", 404);

  return jsonOk(customer);
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

  const parsed = customerSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { billingAddress, shippingAddress, ...data } = parsed.data;
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.customer.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Customer not found", 404);

  try {
    const customer = await prisma.customer.update({
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
      entityType: "Customer",
      entityId: customer.id,
      summary: `Updated customer ${customer.code} · ${customer.name}.`
    });

    return jsonOk(customer);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Customer code already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.customer.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Customer not found", 404);

  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Customer",
    entityId: customer.id,
    summary: `Deleted customer ${customer.code} · ${customer.name}.`
  });

  return jsonOk(customer);
}
