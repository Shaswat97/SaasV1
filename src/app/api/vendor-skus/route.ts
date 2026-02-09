import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const vendorSkuSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  skuId: z.string().min(1, "SKU is required"),
  lastPrice: z.number().nonnegative().optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId");
  const companyId = await getDefaultCompanyId();

  const mappings = await prisma.vendorSku.findMany({
    where: {
      companyId,
      ...(vendorId ? { vendorId } : {})
    },
    include: {
      sku: true,
      vendor: true
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(mappings);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = vendorSkuSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const vendor = await prisma.vendor.findFirst({
    where: { id: parsed.data.vendorId, companyId, deletedAt: null }
  });
  if (!vendor) return jsonError("Vendor not found", 404);

  const sku = await prisma.sku.findFirst({
    where: { id: parsed.data.skuId, companyId, deletedAt: null }
  });
  if (!sku) return jsonError("SKU not found", 404);

  if ((vendor.vendorType ?? "RAW") === "RAW" && sku.type !== "RAW") {
    return jsonError("Raw vendors can only be linked to raw SKUs", 400);
  }
  if ((vendor.vendorType ?? "RAW") === "SUBCONTRACT" && sku.type !== "FINISHED") {
    return jsonError("Subcontract vendors can only be linked to finished SKUs", 400);
  }

  const mapping = await prisma.vendorSku.upsert({
    where: { vendorId_skuId: { vendorId: vendor.id, skuId: sku.id } },
    update: { lastPrice: parsed.data.lastPrice },
    create: {
      companyId,
      vendorId: vendor.id,
      skuId: sku.id,
      lastPrice: parsed.data.lastPrice
    },
    include: { sku: true, vendor: true }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "Vendor",
    entityId: vendor.id,
    summary: `Linked ${sku.code} · ${sku.name} to vendor ${vendor.code} · ${vendor.name}.`
  });

  return jsonOk(mapping, { status: 201 });
}
