import { getTenantPrisma } from "@/lib/tenant-prisma";
import { companySchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { toAddressFields } from "@/lib/address";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const companies = await prisma.company.findMany({
    where: includeDeleted ? {} : { deletedAt: null },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(companies);
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

  const parsed = companySchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const { billingAddress, shippingAddress, ...data } = parsed.data;
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const company = await prisma.company.create({
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
    action: "CREATE",
    entityType: "Company",
    entityId: company.id,
    summary: `Created company ${company.name}.`
  });

  return jsonOk(company, { status: 201 });
}
