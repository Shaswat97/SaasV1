import { prisma } from "@/lib/prisma";
import { bomSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const bom = await prisma.bom.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: {
      finishedSku: true,
      lines: { where: { deletedAt: null }, include: { rawSku: true } }
    }
  });

  if (!bom) return jsonError("BOM not found", 404);

  return jsonOk(bom);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = bomSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  if (parsed.data.lines && parsed.data.lines.length === 0) {
    return jsonError("At least one BOM line is required", 400);
  }
  if (parsed.data.lines) {
    const rawSkuIdSet = new Set(parsed.data.lines.map((line) => line.rawSkuId));
    if (rawSkuIdSet.size !== parsed.data.lines.length) {
      return jsonError("Duplicate raw SKUs are not allowed in a BOM", 400);
    }
  }

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const existing = await prisma.bom.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("BOM not found", 404);

  if (parsed.data.finishedSkuId) {
    const finishedSku = await prisma.sku.findFirst({
      where: { id: parsed.data.finishedSkuId, companyId, deletedAt: null }
    });

    if (!finishedSku) return jsonError("Finished SKU not found", 404);
    if (finishedSku.type !== "FINISHED") {
      return jsonError("BOM requires a finished SKU", 400);
    }
  }

  if (parsed.data.version) {
    const duplicate = await prisma.bom.findFirst({
      where: {
        companyId,
        finishedSkuId: parsed.data.finishedSkuId ?? existing.finishedSkuId,
        version: parsed.data.version,
        deletedAt: null,
        NOT: { id: existing.id }
      }
    });
    if (duplicate) {
      return jsonError("BOM version already exists for this finished SKU", 409);
    }
  }

  if (parsed.data.lines) {
    const rawSkuIds = parsed.data.lines.map((line) => line.rawSkuId);
    const rawSkus = await prisma.sku.findMany({
      where: { id: { in: rawSkuIds }, companyId, deletedAt: null }
    });

    if (rawSkus.length !== rawSkuIds.length) {
      return jsonError("One or more raw SKUs are invalid", 400);
    }
    if (rawSkus.some((sku) => sku.type !== "RAW")) {
      return jsonError("All BOM lines must reference raw SKUs", 400);
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bom.update({
        where: { id: params.id },
        data: {
          finishedSkuId: parsed.data.finishedSkuId,
          version: parsed.data.version,
          name: parsed.data.name,
          active: parsed.data.active
        }
      });

      if (parsed.data.lines) {
        await tx.bomLine.updateMany({
          where: { bomId: params.id, deletedAt: null },
          data: { deletedAt: new Date() }
        });

        await tx.bomLine.createMany({
          data: parsed.data.lines.map((line) => ({
            bomId: params.id,
            rawSkuId: line.rawSkuId,
            quantity: line.quantity,
            scrapPct: line.scrapPct
          }))
        });
      }
    });

    const bom = await prisma.bom.findUnique({
      where: { id: params.id },
      include: { finishedSku: true, lines: { include: { rawSku: true } } }
    });

    if (bom) {
      await recordActivity({
        companyId,
        actorName,
        actorEmployeeId,
        action: "UPDATE",
        entityType: "BOM",
        entityId: bom.id,
        summary: `Updated BOM v${bom.version} for ${bom.finishedSku?.code ?? "finished SKU"}.`
      });
    }

    return jsonOk(bom);
  } catch (error: any) {
    if (error?.code === "P2002") return jsonError("BOM version already exists", 409);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const existing = await prisma.bom.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("BOM not found", 404);

  const bom = await prisma.bom.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "BOM",
    entityId: bom.id,
    summary: "Deleted BOM."
  });

  return jsonOk(bom);
}
