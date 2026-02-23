import type { Prisma, PrismaClient, StockLedger } from "@prisma/client";
import { getTenantPrisma } from "@/lib/tenant-prisma";

export type MovementDirection = "IN" | "OUT";
export type MovementType = "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT" | "PRODUCE" | "SCRAP_SALE";

export type StockMovementInput = {
  companyId: string;
  skuId: string;
  zoneId: string;
  quantity: number;
  direction: MovementDirection;
  movementType: MovementType;
  costPerUnit?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
};

function getValuationMethod(type: string, company: { rawValuationMethod: string; finishedValuationMethod: string; wipValuationMethod: string }) {
  if (type === "RAW") return company.rawValuationMethod;
  if (type === "FINISHED") return company.finishedValuationMethod;
  return company.wipValuationMethod;
}

async function resolveCostPerUnit({
  sku,
  company,
  incomingCost
}: {
  sku: { type: string; lastPurchasePrice: number | null; standardCost: number | null; manufacturingCost: number | null };
  company: { rawValuationMethod: string; finishedValuationMethod: string; wipValuationMethod: string };
  incomingCost?: number | null;
}) {
  if (incomingCost !== undefined && incomingCost !== null) return incomingCost;

  const method = getValuationMethod(sku.type, company);
  if (method === "LAST_PRICE" && sku.lastPurchasePrice) return sku.lastPurchasePrice;
  if (method === "STANDARD_COST" && sku.standardCost) return sku.standardCost;
  if (method === "MANUFACTURING_COST" && sku.manufacturingCost) return sku.manufacturingCost;

  return null;
}

export async function recordStockMovement(
  input: StockMovementInput,
  tx?: Prisma.TransactionClient | PrismaClient
): Promise<StockLedger> {
  if (input.quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  const db = tx ?? (await getTenantPrisma());
  if (!db) {
    throw new Error("Tenant not found");
  }

  const company = await db.company.findUnique({
    where: { id: input.companyId },
    select: { rawValuationMethod: true, finishedValuationMethod: true, wipValuationMethod: true }
  });

  if (!company) throw new Error("Company not found");

  const sku = await db.sku.findUnique({
    where: { id: input.skuId },
    select: { id: true, type: true, lastPurchasePrice: true, standardCost: true, manufacturingCost: true }
  });

  if (!sku) throw new Error("SKU not found");

  const zone = await db.zone.findUnique({
    where: { id: input.zoneId },
    select: { id: true }
  });

  if (!zone) throw new Error("Zone not found");

  const balance = await db.stockBalance.findUnique({
    where: { companyId_skuId_zoneId: { companyId: input.companyId, skuId: input.skuId, zoneId: input.zoneId } }
  });

  const currentQty = balance?.quantityOnHand ?? 0;
  const currentCostPerUnit = balance?.costPerUnit ?? 0;
  const currentTotalCost = balance?.totalCost ?? 0;

  const resolvedCost = await resolveCostPerUnit({
    sku,
    company,
    incomingCost: input.costPerUnit
  });

  if (input.direction === "IN" && (resolvedCost === null || resolvedCost === undefined)) {
    throw new Error("Cost per unit is required for inbound movements");
  }

  const movementCost =
    input.direction === "IN"
      ? (resolvedCost ?? 0)
      : (input.costPerUnit !== undefined && input.costPerUnit !== null ? input.costPerUnit : currentCostPerUnit);
  const quantityDelta = input.direction === "IN" ? input.quantity : -input.quantity;

  let nextQty = currentQty + quantityDelta;
  if (nextQty < 0) {
    throw new Error("Insufficient stock in zone");
  }

  let nextTotalCost = currentTotalCost + quantityDelta * movementCost;
  if (nextTotalCost < 0) nextTotalCost = 0;

  let nextCostPerUnit = 0;
  const method = getValuationMethod(sku.type, company);

  if (nextQty === 0) {
    nextCostPerUnit = 0;
  } else if (method === "LAST_PRICE" && input.direction === "IN" && resolvedCost !== null) {
    nextCostPerUnit = resolvedCost;
    nextTotalCost = nextQty * nextCostPerUnit;
  } else if (method === "STANDARD_COST" && sku.standardCost) {
    nextCostPerUnit = sku.standardCost;
    nextTotalCost = nextQty * nextCostPerUnit;
  } else {
    nextCostPerUnit = nextTotalCost / nextQty;
  }

  if (tx) {
    const ledger = await db.stockLedger.create({
      data: {
        companyId: input.companyId,
        skuId: input.skuId,
        zoneId: input.zoneId,
        direction: input.direction,
        movementType: input.movementType,
        quantity: input.quantity,
        costPerUnit: movementCost,
        totalCost: input.quantity * movementCost,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        notes: input.notes ?? null
      }
    });

    await db.stockBalance.upsert({
      where: { companyId_skuId_zoneId: { companyId: input.companyId, skuId: input.skuId, zoneId: input.zoneId } },
      update: {
        quantityOnHand: nextQty,
        costPerUnit: nextCostPerUnit,
        totalCost: nextTotalCost
      },
      create: {
        companyId: input.companyId,
        skuId: input.skuId,
        zoneId: input.zoneId,
        quantityOnHand: nextQty,
        costPerUnit: nextCostPerUnit,
        totalCost: nextTotalCost
      }
    });

    return ledger;
  }

  const movement = await (db as PrismaClient).$transaction(async (txLocal) => {
    const ledger = await recordStockMovement(input, txLocal);
    return ledger;
  });

  return movement;
}

export async function transferStock({
  companyId,
  skuId,
  fromZoneId,
  toZoneId,
  quantity,
  costPerUnit,
  referenceType,
  referenceId,
  notes
}: {
  companyId: string;
  skuId: string;
  fromZoneId: string;
  toZoneId: string;
  quantity: number;
  costPerUnit?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
}) {
  if (fromZoneId === toZoneId) {
    throw new Error("Source and destination zones must be different");
  }

  const outbound = await recordStockMovement({
    companyId,
    skuId,
    zoneId: fromZoneId,
    quantity,
    direction: "OUT",
    movementType: "TRANSFER",
    costPerUnit,
    referenceType,
    referenceId,
    notes
  });

  await recordStockMovement({
    companyId,
    skuId,
    zoneId: toZoneId,
    quantity,
    direction: "IN",
    movementType: "TRANSFER",
    costPerUnit: outbound.costPerUnit,
    referenceType,
    referenceId,
    notes
  });
}
