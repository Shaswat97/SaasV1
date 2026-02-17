import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { recordStockMovement } from "@/lib/stock-service";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const receiveLineSchema = z.object({
  poLineId: z.string().min(1, "PO line is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  qcStatus: z.string().optional(),
  qcNotes: z.string().optional(),
  qcPassedQty: z.number().nonnegative().optional()
});

const receiveSchema = z.object({
  zoneId: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(receiveLineSchema).min(1, "At least one line is required")
});

function computeNetUnitCost(unitPrice: number, discountPct: number, taxPct: number) {
  const discounted = unitPrice * (1 - discountPct / 100);
  return discounted * (1 + taxPct / 100);
}

async function buildBillNumber(tx: any, companyId: string, at: Date) {
  const yy = String(at.getFullYear()).slice(-2);
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const prefix = `BILL-${yy}${mm}`;
  const count = await tx.vendorBill.count({
    where: { companyId, billNumber: { startsWith: prefix } }
  });
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
}

async function buildRawBatchNumber(tx: any, companyId: string, at: Date) {
  const yy = String(at.getFullYear()).slice(-2);
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const prefix = `RB-${yy}${mm}`;
  const count = await tx.rawMaterialBatch.count({
    where: { companyId, batchNumber: { startsWith: prefix } }
  });
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${seq}`;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = receiveSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { lines: true, vendor: true }
  });

  if (!order) return jsonError("Purchase order not found", 404);
  if (["CANCELLED", "RECEIVED", "CLOSED"].includes(order.status)) {
    return jsonError("Completed or cancelled orders cannot be received", 400);
  }
  if (order.status !== "APPROVED") {
    return jsonError("Only APPROVED orders can be received", 400);
  }

  const lineMap = new Map(order.lines.map((line) => [line.id, line]));
  for (const line of parsed.data.lines) {
    const existing = lineMap.get(line.poLineId);
    if (!existing) return jsonError("One or more PO lines are invalid", 400);
    const remaining = existing.quantity - existing.receivedQty;
    if (line.quantity > remaining) {
      return jsonError("Received quantity exceeds remaining quantity", 400);
    }
  }

  const defaultZoneType = order.type === "SUBCONTRACT" ? "FINISHED" : "RAW_MATERIAL";
  const zone = parsed.data.zoneId
    ? await prisma.zone.findFirst({ where: { id: parsed.data.zoneId, companyId, deletedAt: null } })
    : await prisma.zone.findFirst({ where: { companyId, type: defaultZoneType, deletedAt: null } });

  if (!zone) {
    return jsonError(`${defaultZoneType === "FINISHED" ? "Finished" : "Raw material"} zone not found`, 404);
  }
  if (order.type === "SUBCONTRACT" && zone.type !== "FINISHED") {
    return jsonError("Subcontract receiving must be into a FINISHED zone", 400);
  }
  if (order.type === "RAW" && zone.type !== "RAW_MATERIAL") {
    return jsonError("Receiving must be into a RAW_MATERIAL zone", 400);
  }

  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const allocationRows = order.type === "SUBCONTRACT"
        ? await tx.purchaseOrderAllocation.findMany({
            where: { poLineId: { in: order.lines.map((line) => line.id) } }
          })
        : [];
      const allocationsByLine = new Map<string, Array<{ soLineId: string; quantity: number }>>();
      allocationRows.forEach((row) => {
        if (!allocationsByLine.has(row.poLineId)) allocationsByLine.set(row.poLineId, []);
        allocationsByLine.get(row.poLineId)!.push({ soLineId: row.soLineId, quantity: row.quantity });
      });

      const created = await tx.goodsReceipt.create({
        data: {
          companyId,
          vendorId: order.vendorId,
          purchaseOrderId: order.id,
          notes: parsed.data.notes
        }
      });

      const billLines: Array<{ skuId: string; quantity: number; unitPrice: number; totalCost: number }> = [];

      for (const line of parsed.data.lines) {
        const poLine = lineMap.get(line.poLineId)!;
        const netCost = computeNetUnitCost(poLine.unitPrice, poLine.discountPct ?? 0, poLine.taxPct ?? 0);

        const createdLine = await tx.goodsReceiptLine.create({
          data: {
            receiptId: created.id,
            poLineId: poLine.id,
            skuId: poLine.skuId,
            quantity: line.quantity,
            costPerUnit: netCost,
            totalCost: netCost * line.quantity
          }
        });

        if (order.type === "RAW") {
          const batchNumber = await buildRawBatchNumber(tx, companyId, created.receivedAt);
          await tx.rawMaterialBatch.create({
            data: {
              companyId,
              skuId: poLine.skuId,
              zoneId: zone.id,
              receiptLineId: createdLine.id,
              batchNumber,
              receivedAt: created.receivedAt,
              quantityReceived: line.quantity,
              quantityRemaining: line.quantity,
              costPerUnit: netCost,
              notes: `Auto batch from GRN ${created.id}`
            }
          });
        }

        billLines.push({
          skuId: poLine.skuId,
          quantity: line.quantity,
          unitPrice: netCost,
          totalCost: netCost * line.quantity
        });

        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: {
            receivedQty: poLine.receivedQty + line.quantity,
            qcStatus: line.qcStatus ?? poLine.qcStatus,
            qcNotes: line.qcNotes ?? poLine.qcNotes,
            qcPassedQty: line.qcPassedQty ?? poLine.qcPassedQty
          }
        });

        await tx.sku.update({
          where: { id: poLine.skuId },
          data: { lastPurchasePrice: netCost }
        });

        await tx.vendorSku.upsert({
          where: { vendorId_skuId: { vendorId: order.vendorId, skuId: poLine.skuId } },
          update: { lastPrice: netCost },
          create: {
            companyId,
            vendorId: order.vendorId,
            skuId: poLine.skuId,
            lastPrice: netCost
          }
        });

        await recordStockMovement(
          {
            companyId,
            skuId: poLine.skuId,
            zoneId: zone.id,
            quantity: line.quantity,
            direction: "IN",
            movementType: "RECEIPT",
            costPerUnit: netCost,
            referenceType: "GRN",
            referenceId: created.id
          },
          tx
        );

        if (order.type === "SUBCONTRACT") {
          const allocations = allocationsByLine.get(poLine.id) ?? [];
          if (allocations.length) {
            for (const alloc of allocations) {
              const share = poLine.quantity > 0 ? alloc.quantity / poLine.quantity : 0;
              const producedQty = line.quantity * share;
              if (producedQty > 0) {
                await tx.salesOrderLine.update({
                  where: { id: alloc.soLineId },
                  data: { producedQty: { increment: producedQty } }
                });
              }
            }
          }
        }
      }

      const billDate = new Date();
      const dueDate = (order.vendor?.creditDays ?? 0) > 0
        ? new Date(billDate.getTime() + (order.vendor?.creditDays ?? 0) * 86400000)
        : null;
      const billNumber = await buildBillNumber(tx, companyId, billDate);
      const totalAmount = billLines.reduce((sum, line) => sum + line.totalCost, 0);

      await tx.vendorBill.create({
        data: {
          companyId,
          vendorId: order.vendorId,
          purchaseOrderId: order.id,
          receiptId: created.id,
          billNumber,
          billDate,
          dueDate: dueDate ?? undefined,
          currency: order.currency,
          totalAmount,
          balanceAmount: totalAmount,
          status: totalAmount > 0 ? "UNPAID" : "PAID",
          lines: {
            create: billLines.map((line) => ({
              skuId: line.skuId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              totalCost: line.totalCost
            }))
          }
        }
      });

      return created;
    });

    const updatedLines = await prisma.purchaseOrderLine.findMany({
      where: { purchaseOrderId: order.id },
      include: { sku: true }
    });
    const remainingLines = updatedLines
      .filter((line) => line.receivedQty < line.quantity)
      .map((line) => ({
        skuId: line.skuId,
        skuCode: line.sku.code,
        skuName: line.sku.name,
        remainingQty: line.quantity - line.receivedQty,
        unit: line.sku.unit
      }));
    const allReceived = remainingLines.length === 0;
    if (allReceived) {
      await prisma.purchaseOrder.update({
        where: { id: order.id },
        data: { status: "RECEIVED" }
      });
    }

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "UPDATE",
      entityType: "Purchase Order",
      entityId: order.id,
      summary: `Received ${parsed.data.lines.length} line(s) for PO ${order.poNumber ?? order.id}.`
    });

    return jsonOk(
      {
        receiptId: receipt.id,
        purchaseOrderId: order.id,
        fullyReceived: allReceived,
        remainingLines
      },
      { status: 201 }
    );
  } catch (error: any) {
    const message = error?.message ?? "Failed to post receipt";
    return jsonError(message, 400);
  }
}
