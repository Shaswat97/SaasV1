import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!order) return jsonError("Purchase order not found", 404);

  const receipts = await prisma.goodsReceipt.findMany({
    where: { purchaseOrderId: order.id },
    include: {
      lines: { include: { sku: true, poLine: true } }
    },
    orderBy: { receivedAt: "desc" }
  });

  return jsonOk(receipts);
}
