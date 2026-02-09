import { getTenantPrisma } from "@/lib/tenant-prisma";
import { bomSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId(prisma);

  const boms = await prisma.bom.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    include: {
      finishedSku: true,
      lines: {
        where: includeDeleted ? {} : { deletedAt: null },
        include: { rawSku: true }
      }
    },
    orderBy: [{ finishedSkuId: "asc" }, { version: "desc" }]
  });

  return jsonOk(boms);
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

  const parsed = bomSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const rawSkuIdSet = new Set(parsed.data.lines.map((line) => line.rawSkuId));
  if (rawSkuIdSet.size !== parsed.data.lines.length) {
    return jsonError("Duplicate raw SKUs are not allowed in a BOM", 400);
  }

  const finishedSku = await prisma.sku.findFirst({
    where: { id: parsed.data.finishedSkuId, companyId, deletedAt: null }
  });

  if (!finishedSku) return jsonError("Finished SKU not found", 404);
  if (finishedSku.type !== "FINISHED") {
    return jsonError("BOM requires a finished SKU", 400);
  }

  const rawSkuIds = parsed.data.lines.map((line) => line.rawSkuId);
  const rawSkus = await prisma.sku.findMany({
    where: {
      id: { in: rawSkuIds },
      companyId,
      deletedAt: null
    }
  });

  if (rawSkus.length !== rawSkuIds.length) {
    return jsonError("One or more raw SKUs are invalid", 400);
  }

  if (rawSkus.some((sku) => sku.type !== "RAW")) {
    return jsonError("All BOM lines must reference raw SKUs", 400);
  }

  try {
    const bom = await prisma.$transaction(async (tx) => {
      const requestedVersion = parsed.data.version;
      if (requestedVersion) {
        const existing = await tx.bom.findFirst({
          where: { companyId, finishedSkuId: parsed.data.finishedSkuId, version: requestedVersion, deletedAt: null }
        });
        if (existing) {
          throw new Error("BOM version already exists for this finished SKU");
        }
      }

      const latest = await tx.bom.findFirst({
        where: { companyId, finishedSkuId: parsed.data.finishedSkuId, deletedAt: null },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      const nextVersion = requestedVersion ?? (latest?.version ? latest.version + 1 : 1);
      const created = await tx.bom.create({
        data: {
          companyId,
          finishedSkuId: parsed.data.finishedSkuId,
          version: nextVersion,
          name: parsed.data.name,
          active: parsed.data.active ?? true
        }
      });

      await tx.bomLine.createMany({
        data: parsed.data.lines.map((line) => ({
          bomId: created.id,
          rawSkuId: line.rawSkuId,
          quantity: line.quantity,
          scrapPct: line.scrapPct
        }))
      });

      return created;
    });

    const result = await prisma.bom.findUnique({
      where: { id: bom.id },
      include: { finishedSku: true, lines: { include: { rawSku: true } } }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "BOM",
      entityId: result?.id ?? bom.id,
      summary: `Created BOM v${result?.version ?? "?"} for ${result?.finishedSku?.code ?? "finished SKU"}.`
    });

    return jsonOk(result, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes("BOM version already exists")) {
      return jsonError(error.message, 409);
    }
    if (error?.code === "P2002") return jsonError("BOM version already exists", 409);
    throw error;
  }
}
