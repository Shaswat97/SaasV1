import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const subcontractLineSchema = z.object({
  lineId: z.string().min(1, "Sales order line is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().nonnegative().optional()
});

const subcontractSchema = z.object({
  vendorId: z.string().min(1, "Subcontractor is required"),
  notes: z.string().optional(),
  lines: z.array(subcontractLineSchema).min(1, "Add at least one line")
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = subcontractSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const order = await prisma.salesOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: { include: { sku: true } } }
  });
  if (!order) return jsonError("Sales order not found", 404);

  const vendor = await prisma.vendor.findFirst({
    where: { id: parsed.data.vendorId, companyId, deletedAt: null }
  });
  if (!vendor) return jsonError("Vendor not found", 404);
  if ((vendor.vendorType ?? "RAW") !== "SUBCONTRACT") {
    return jsonError("Vendor is not marked as a subcontractor", 400);
  }

  const lineMap = new Map(order.lines.map((line) => [line.id, line]));
  for (const line of parsed.data.lines) {
    const orderLine = lineMap.get(line.lineId);
    if (!orderLine) return jsonError("Line does not belong to this sales order", 400);
    if (orderLine.sku.type !== "FINISHED") return jsonError("Subcontracting requires FINISHED SKUs", 400);
    const openQty = Math.max(orderLine.quantity - (orderLine.producedQty ?? 0) - (orderLine.deliveredQty ?? 0), 0);
    if (line.quantity > openQty) {
      return jsonError("Subcontract quantity exceeds open quantity", 400);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const vendorForSeq = await tx.vendor.findFirst({
      where: { id: vendor.id, companyId },
      select: { id: true, code: true, poSequence: true }
    });
    if (!vendorForSeq) throw new Error("Vendor not found");

    const nextSeq = vendorForSeq.poSequence + 1;
    await tx.vendor.update({
      where: { id: vendorForSeq.id },
      data: { poSequence: nextSeq }
    });

    const poNumber = `PO-${vendorForSeq.code}-${String(nextSeq).padStart(4, "0")}`;

    const po = await tx.purchaseOrder.create({
      data: {
        companyId,
        vendorId: vendor.id,
        poNumber,
        type: "SUBCONTRACT",
        status: "DRAFT",
        orderDate: new Date(),
        currency: "INR",
        notes: parsed.data.notes ?? `Subcontract for Sales Order ${order.soNumber ?? order.id}`
      }
    });

    for (const line of parsed.data.lines) {
      const orderLine = lineMap.get(line.lineId)!;
      const unitPrice = line.unitPrice ?? orderLine.sku.manufacturingCost ?? orderLine.sku.sellingPrice ?? 0;
      const poLine = await tx.purchaseOrderLine.create({
        data: {
          purchaseOrderId: po.id,
          skuId: orderLine.skuId,
          description: `Subcontract for Sales Order ${order.soNumber ?? order.id}`,
          quantity: line.quantity,
          unitPrice,
          discountPct: 0,
          taxPct: 0,
          qcStatus: "PENDING"
        }
      });

      await tx.purchaseOrderAllocation.create({
        data: {
          poLineId: poLine.id,
          soLineId: orderLine.id,
          quantity: line.quantity
        }
      });
    }

    return tx.purchaseOrder.findUnique({
      where: { id: po.id },
      include: { vendor: true, lines: { include: { sku: true } } }
    });
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Purchase Order",
    entityId: result?.id ?? null,
    summary: `Created subcontract PO for sales order ${order.soNumber ?? order.id}.`
  });

  return jsonOk(result, { status: 201 });
}
