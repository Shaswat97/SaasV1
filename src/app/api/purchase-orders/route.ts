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

const poSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  poNumber: z.string().optional(),
  type: z.enum(["RAW", "SUBCONTRACT"]).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "RECEIVED", "CLOSED", "CANCELLED"]).optional(),
  orderDate: z.string().datetime().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  consolidate: z.boolean().optional(),
  lines: z.array(poLineSchema).optional()
});

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);
  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted");
  const includeAll = includeDeleted === "true" || includeDeleted === "1";
  const includeAllocations = url.searchParams.get("includeAllocations") === "true";

  const orders = await prisma.purchaseOrder.findMany({
    where: includeAll ? { companyId } : { companyId, deletedAt: null },
    include: {
      vendor: true,
      lines: includeAllocations
        ? {
            include: {
              sku: true,
              allocations: {
                include: {
                  soLine: {
                    include: {
                      salesOrder: { select: { id: true, soNumber: true, customer: { select: { name: true } } } },
                      sku: { select: { code: true, name: true, unit: true } }
                    }
                  }
                }
              }
            }
          }
        : { include: { sku: true } },
      receipts: true
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(orders);
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

  const parsed = poSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const status = parsed.data.status ?? "DRAFT";
  const poType = parsed.data.type ?? "RAW";

  const vendor = await prisma.vendor.findFirst({
    where: { id: parsed.data.vendorId, companyId, deletedAt: null }
  });

  if (!vendor) return jsonError("Vendor not found", 404);
  if (poType === "SUBCONTRACT" && (vendor.vendorType ?? "RAW") !== "SUBCONTRACT") {
    return jsonError("Vendor is not marked as a subcontractor", 400);
  }

  const lines = parsed.data.lines ?? [];

  if (lines.length > 0) {
    const skuIds = lines.map((line) => line.skuId);
    const skus = await prisma.sku.findMany({
      where: { id: { in: skuIds }, companyId, deletedAt: null }
    });

    if (skus.length !== skuIds.length) {
      return jsonError("One or more SKUs are invalid", 400);
    }
    if (poType === "RAW" && skus.some((sku) => sku.type !== "RAW")) {
      return jsonError("PO lines must reference RAW SKUs", 400);
    }
    if (poType === "SUBCONTRACT" && skus.some((sku) => sku.type !== "FINISHED")) {
      return jsonError("Subcontract POs must reference FINISHED SKUs", 400);
    }

    const vendorSkus = await prisma.vendorSku.findMany({
      where: { companyId, vendorId: vendor.id }
    });
    if (!vendorSkus.length) {
      return jsonError("Vendor has no linked SKUs. Link SKUs before creating a PO.", 400);
    }
    const allowed = new Set(vendorSkus.map((mapping) => mapping.skuId));
    if (lines.some((line) => !allowed.has(line.skuId))) {
      return jsonError("One or more SKUs are not linked to this vendor", 400);
    }
  }

  const consolidate = parsed.data.consolidate ?? true;
  if (status === "DRAFT" && consolidate) {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { companyId, vendorId: vendor.id, status: "DRAFT", type: poType, deletedAt: null }
    });

    if (existing) {
      if (lines.length > 0) {
        await prisma.purchaseOrderLine.createMany({
          data: lines.map((line) => ({
            purchaseOrderId: existing.id,
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

      const updated = await prisma.purchaseOrder.findUnique({
        where: { id: existing.id },
        include: { vendor: true, lines: { include: { sku: true } } }
      });

      if (updated) {
        await recordActivity({
          companyId,
          actorName,
          actorEmployeeId,
          action: "UPDATE",
          entityType: "Purchase Order",
          entityId: updated.id,
          summary: `Updated draft PO ${updated.poNumber ?? updated.id} (${poType}).`
        });
      }

      return jsonOk(updated, { status: 201 });
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    let poNumber = parsed.data.poNumber;

    if (!poNumber) {
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

      poNumber = `PO-${vendorForSeq.code}-${String(nextSeq).padStart(4, "0")}`;
    }

    return tx.purchaseOrder.create({
      data: {
        companyId,
        vendorId: vendor.id,
        poNumber,
        type: poType,
        status,
        orderDate: parsed.data.orderDate ? new Date(parsed.data.orderDate) : undefined,
        currency: parsed.data.currency ?? "INR",
        notes: parsed.data.notes,
        lines: lines.length
          ? {
              create: lines.map((line) => ({
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
            }
          : undefined
      },
      include: { vendor: true, lines: { include: { sku: true } } }
    });
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Purchase Order",
    entityId: order.id,
    summary: `Created ${poType === "SUBCONTRACT" ? "subcontract" : "purchase"} PO ${order.poNumber ?? order.id}.`
  });

  return jsonOk(order, { status: 201 });
}
