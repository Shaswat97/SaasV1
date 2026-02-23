import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "purchase.view");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId") || undefined;
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));

  const bills = await prisma.vendorBill.findMany({
    where: {
      companyId,
      ...(vendorId ? { vendorId } : {})
    },
    include: {
      vendor: { select: { id: true, code: true, name: true } },
      purchaseOrder: { select: { id: true, poNumber: true } },
      receipt: { select: { id: true, receivedAt: true } },
      lines: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalCost: true,
          sku: { select: { id: true, code: true, name: true, unit: true } }
        }
      },
      payments: { include: { payment: true } }
    },
    orderBy: { billDate: "desc" }
  });

  return jsonOk(bills);
}
