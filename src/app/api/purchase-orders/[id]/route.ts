import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const poLineSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().positive("Unit price must be greater than 0"),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional(),
  expectedDate: z.string().datetime().optional(),
  qcStatus: z.string().optional(),
  qcNotes: z.string().optional()
});

const poUpdateSchema = z.object({
  poNumber: z.string().optional(),
  orderDate: z.string().datetime().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(poLineSchema).optional()
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { vendor: true, lines: { include: { sku: true } }, receipts: true }
  });

  if (!order) return jsonError("Purchase order not found", 404);

  return jsonOk(order);
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

  const parsed = poUpdateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: params.id, companyId, deletedAt: null },
      include: { lines: true }
    });

    if (!order) return jsonError("Purchase order not found", 404);

    if (!["DRAFT", "PENDING"].includes(order.status)) {
      return jsonError("Only DRAFT or PENDING orders can be edited", 400);
    }

    const lines = parsed.data.lines;
    if (order.type === "SUBCONTRACT" && lines) {
      const allocationCount = await prisma.purchaseOrderAllocation.count({
        where: { poLine: { purchaseOrderId: order.id } }
      });
      if (allocationCount > 0) {
        return jsonError("Subcontract POs linked to sales orders cannot be edited", 400);
      }
    }
    if (lines && order.lines.some((line) => line.receivedQty > 0)) {
      return jsonError("Cannot edit lines after receiving has started", 400);
    }

    if (lines && lines.length > 0) {
      const skuIds = lines.map((line) => line.skuId);
      const skus = await prisma.sku.findMany({
        where: { id: { in: skuIds }, companyId, deletedAt: null }
      });

      if (skus.length !== skuIds.length) {
        return jsonError("One or more SKUs are invalid", 400);
      }
      if (order.type === "RAW" && skus.some((sku) => sku.type !== "RAW")) {
        return jsonError("PO lines must reference RAW SKUs", 400);
      }
      if (order.type === "SUBCONTRACT" && skus.some((sku) => sku.type !== "FINISHED")) {
        return jsonError("Subcontract POs must reference FINISHED SKUs", 400);
      }

      const vendorSkus = await prisma.vendorSku.findMany({
        where: { companyId, vendorId: order.vendorId }
      });
      if (!vendorSkus.length) {
        return jsonError("Vendor has no linked SKUs. Link SKUs before editing this PO.", 400);
      }
      const allowed = new Set(vendorSkus.map((mapping) => mapping.skuId));
      if (lines.some((line) => !allowed.has(line.skuId))) {
        return jsonError("One or more SKUs are not linked to this vendor", 400);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const header = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          poNumber: parsed.data.poNumber,
          orderDate: parsed.data.orderDate ? new Date(parsed.data.orderDate) : undefined,
          currency: parsed.data.currency,
          notes: parsed.data.notes
        }
      });

      if (lines) {
        await tx.purchaseOrderAllocation.deleteMany({
          where: { poLine: { purchaseOrderId: order.id } }
        });
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: order.id } });
        if (lines.length > 0) {
          await tx.purchaseOrderLine.createMany({
            data: lines.map((line) => ({
              purchaseOrderId: order.id,
              skuId: line.skuId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountPct: line.discountPct ?? 0,
              taxPct: line.taxPct ?? 0,
              expectedDate: line.expectedDate ? new Date(line.expectedDate) : null,
              qcStatus: line.qcStatus ?? "PENDING",
              qcNotes: line.qcNotes
            }))
          });
        }
      }

      return header;
    });

    const result = await prisma.purchaseOrder.findUnique({
      where: { id: updated.id },
      include: { vendor: true, lines: { include: { sku: true } } }
    });

    if (result) {
      await recordActivity({
        companyId,
        actorName,
        actorEmployeeId,
        action: "UPDATE",
        entityType: "Purchase Order",
        entityId: result.id,
        summary: `Updated PO ${result.poNumber ?? result.id}.`
      });
    }

    return jsonOk(result);
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to update purchase order");
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!order) return jsonError("Purchase order not found", 404);

  const updated = await prisma.purchaseOrder.update({
    where: { id: order.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Purchase Order",
    entityId: updated.id,
    summary: `Deleted PO ${updated.poNumber ?? updated.id}.`
  });

  return jsonOk(updated);
}
