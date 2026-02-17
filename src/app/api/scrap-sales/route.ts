import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { requirePermission } from "@/lib/permissions";
import { recordStockMovement } from "@/lib/stock-service";
import { recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const scrapLineSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().positive("Unit price must be greater than 0")
});

const scrapSaleSchema = z.object({
  buyerName: z.string().optional(),
  vendorId: z.string().optional(),
  saleDate: z.string().datetime().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(scrapLineSchema).min(1, "Add at least one line")
}).superRefine((data, context) => {
  const hasBuyerName = Boolean(data.buyerName?.trim());
  const hasVendorId = Boolean(data.vendorId?.trim());
  if (!hasBuyerName && !hasVendorId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Buyer name or scrap vendor is required",
      path: ["buyerName"]
    });
  }
});

function formatSalePrefix(date: Date) {
  const year = String(date.getFullYear() % 100).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `SCRAP-${year}${month}`;
}

async function generateSaleNumber(tx: Prisma.TransactionClient, companyId: string, saleDate: Date) {
  const prefix = formatSalePrefix(saleDate);
  const rows = await tx.scrapSale.findMany({
    where: { companyId, saleNumber: { startsWith: `${prefix}-` } },
    select: { saleNumber: true }
  });
  const maxSeq = rows.reduce((max, row) => {
    const raw = row.saleNumber.split("-").pop() ?? "0";
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value)) return max;
    return Math.max(max, value);
  }, 0);
  return `${prefix}-${String(maxSeq + 1).padStart(3, "0")}`;
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory.view");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = guard.context?.companyId;
  if (!companyId) return jsonError("Authentication required", 401);

  const sales = await prisma.scrapSale.findMany({
    where: { companyId },
    include: {
      vendor: { select: { id: true, code: true, name: true } },
      lines: { include: { sku: true }, orderBy: { createdAt: "asc" } }
    },
    orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
    take: 100
  });

  return jsonOk(sales);
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "inventory.transfer");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const context = guard.context;
  if (!context) return jsonError("Authentication required", 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  const parsed = scrapSaleSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = context.companyId;
  const resolvedVendorId = parsed.data.vendorId?.trim() || null;
  let resolvedBuyerName = parsed.data.buyerName?.trim() || "";
  if (resolvedVendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: resolvedVendorId, companyId, deletedAt: null },
      select: { id: true, name: true, vendorType: true }
    });
    if (!vendor) return jsonError("Scrap vendor not found.", 404);
    if ((vendor.vendorType ?? "RAW") !== "SCRAP") {
      return jsonError("Selected vendor is not a scrap buyer.", 400);
    }
    resolvedBuyerName = vendor.name;
  }
  if (!resolvedBuyerName) return jsonError("Buyer name is required.", 400);

  const scrapZone = await prisma.zone.findFirst({
    where: { companyId, type: "SCRAP", active: true, deletedAt: null },
    select: { id: true, name: true }
  });
  if (!scrapZone) {
    return jsonError("Active Scrap zone is required before posting scrap sales.", 400);
  }

  const skuIds = Array.from(new Set(parsed.data.lines.map((line) => line.skuId)));
  const skus = await prisma.sku.findMany({
    where: { companyId, id: { in: skuIds }, deletedAt: null },
    select: { id: true, code: true, name: true, unit: true }
  });
  if (skus.length !== skuIds.length) {
    return jsonError("One or more SKUs are invalid.", 400);
  }

  const balances = await prisma.stockBalance.findMany({
    where: { companyId, zoneId: scrapZone.id, skuId: { in: skuIds } },
    select: { skuId: true, quantityOnHand: true, costPerUnit: true }
  });
  const skuById = new Map(skus.map((sku) => [sku.id, sku]));
  const balanceBySku = new Map(balances.map((balance) => [balance.skuId, balance]));

  const requestedQtyBySku = new Map<string, number>();
  for (const line of parsed.data.lines) {
    requestedQtyBySku.set(line.skuId, (requestedQtyBySku.get(line.skuId) ?? 0) + line.quantity);
  }

  for (const [skuId, requestedQty] of requestedQtyBySku.entries()) {
    const onHand = balanceBySku.get(skuId)?.quantityOnHand ?? 0;
    if (requestedQty > onHand) {
      const sku = skuById.get(skuId);
      const label = sku ? `${sku.code} · ${sku.name}` : skuId;
      return jsonError(`Insufficient scrap stock for ${label}. On hand ${onHand}, requested ${requestedQty}.`, 400);
    }
  }

  const saleDate = parsed.data.saleDate ? new Date(parsed.data.saleDate) : new Date();
  const currency = parsed.data.currency?.trim() || "INR";

  const sale = await prisma.$transaction(async (tx) => {
    const saleNumber = await generateSaleNumber(tx, companyId, saleDate);
    const created = await tx.scrapSale.create({
      data: {
        companyId,
        vendorId: resolvedVendorId,
        saleNumber,
        buyerName: resolvedBuyerName,
        saleDate,
        currency,
        notes: parsed.data.notes?.trim() || null
      }
    });

    let totalAmount = 0;
    let totalCost = 0;

    for (const line of parsed.data.lines) {
      const balance = balanceBySku.get(line.skuId);
      const costPerUnit = balance?.costPerUnit ?? 0;
      const lineAmount = line.quantity * line.unitPrice;
      const lineCost = line.quantity * costPerUnit;
      totalAmount += lineAmount;
      totalCost += lineCost;

      await recordStockMovement(
        {
          companyId,
          skuId: line.skuId,
          zoneId: scrapZone.id,
          quantity: line.quantity,
          direction: "OUT",
          movementType: "SCRAP_SALE",
          costPerUnit,
          referenceType: "SCRAP_SALE",
          referenceId: created.id,
          notes: parsed.data.notes?.trim() || `Scrap sold to ${resolvedBuyerName}`
        },
        tx
      );

      await tx.scrapSaleLine.create({
        data: {
          scrapSaleId: created.id,
          skuId: line.skuId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          costPerUnit,
          totalAmount: lineAmount,
          totalCost: lineCost
        }
      });
    }

    await tx.scrapSale.update({
      where: { id: created.id },
      data: { totalAmount, totalCost }
    });

    return tx.scrapSale.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        vendor: { select: { id: true, code: true, name: true } },
        lines: { include: { sku: true } }
      }
    });
  });

  await recordActivity({
    companyId,
    actorName: context.actorName,
    actorEmployeeId: context.actorEmployeeId,
    action: "CREATE",
    entityType: "ScrapSale",
    entityId: sale.id,
    summary: `Recorded scrap sale ${sale.saleNumber} to ${sale.buyerName} (${sale.lines.length} line(s)).`
  });

  return jsonOk(sale);
}
