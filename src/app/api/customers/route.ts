import { getTenantPrisma } from "@/lib/tenant-prisma";
import { customerSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { toAddressFields } from "@/lib/address";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId(prisma);

  const customers = await prisma.customer.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(customers);
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

  const parsed = customerSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { billingAddress, shippingAddress, ...data } = parsed.data;
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const customer = await prisma.customer.create({
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
      entityType: "Customer",
      entityId: customer.id,
      summary: `Created customer ${customer.code} · ${customer.name}.`
    });

    return jsonOk(customer, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Customer code already exists", 409);
    }
    throw error;
  }
}
