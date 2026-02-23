import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const allocationSchema = z.object({
  poLineId: z.string().min(1, "PO line is required"),
  soLineId: z.string().min(1, "SO line is required"),
  quantity: z.number().positive("Quantity must be greater than 0")
});

export async function POST(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = allocationSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);

  const [poLine, soLine] = await Promise.all([
    prisma.purchaseOrderLine.findFirst({
      where: { id: parsed.data.poLineId, purchaseOrder: { companyId } },
      include: { purchaseOrder: true }
    }),
    prisma.salesOrderLine.findFirst({
      where: { id: parsed.data.soLineId, salesOrder: { companyId } }
    })
  ]);

  if (!poLine) return jsonError("PO line not found", 404);
  if (!soLine) return jsonError("SO line not found", 404);

  if (soLine.allocatedQty + parsed.data.quantity > soLine.quantity) {
    return jsonError("Allocated quantity exceeds SO line quantity", 400);
  }

  const allocation = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrderAllocation.create({
      data: {
        poLineId: poLine.id,
        soLineId: soLine.id,
        quantity: parsed.data.quantity
      }
    });

    await tx.salesOrderLine.update({
      where: { id: soLine.id },
      data: { allocatedQty: soLine.allocatedQty + parsed.data.quantity }
    });

    return created;
  });

  return jsonOk(allocation, { status: 201 });
}
