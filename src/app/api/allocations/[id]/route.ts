import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const allocation = await prisma.purchaseOrderAllocation.findFirst({
    where: { id: params.id, poLine: { purchaseOrder: { companyId } } },
    include: { soLine: true }
  });

  if (!allocation) return jsonError("Allocation not found", 404);

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderAllocation.delete({ where: { id: allocation.id } });
    await tx.salesOrderLine.update({
      where: { id: allocation.soLineId },
      data: { allocatedQty: Math.max(allocation.soLine.allocatedQty - allocation.quantity, 0) }
    });
  });

  return jsonOk({ ok: true });
}
