import { z } from "zod";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  skuId: z.string().min(1),
  unitPrice: z.number().positive(),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional(),
  minQty: z.number().positive().optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  active: z.boolean().optional()
});

const updateSchema = z.object({
  customerId: z.string().min(1),
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  notes: z.string().optional(),
  active: z.boolean().optional(),
  lines: z.array(lineSchema).min(1)
});

type ParsedLine = z.infer<typeof lineSchema>;

function hasOverlappingEffectiveWindows(lines: ParsedLine[]) {
  const activeLines = lines.filter((line) => line.active ?? true);
  const groups = new Map<string, Array<{ start: number; end: number }>>();
  for (const line of activeLines) {
    const minQtyKey = line.minQty == null ? "default" : String(line.minQty);
    const key = `${line.skuId}::${minQtyKey}`;
    const start = new Date(line.effectiveFrom).getTime();
    const end = line.effectiveTo ? new Date(line.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
    const bucket = groups.get(key) ?? [];
    bucket.push({ start, end });
    groups.set(key, bucket);
  }
  for (const entries of groups.values()) {
    const sorted = [...entries].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start <= sorted[i - 1].end) return true;
    }
  }
  return false;
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const existing = await prisma.salesPriceList.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    select: { id: true }
  });
  if (!existing) return jsonError("Sales price list not found", 404);

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, companyId, deletedAt: null },
    select: { id: true }
  });
  if (!customer) return jsonError("Customer not found", 404);

  const skuIds = Array.from(new Set(parsed.data.lines.map((line) => line.skuId)));
  const skus = await prisma.sku.findMany({
    where: { id: { in: skuIds }, companyId, deletedAt: null, type: "FINISHED" },
    select: { id: true }
  });
  if (skus.length !== skuIds.length) return jsonError("One or more finished SKUs are invalid", 400);

  const invalidRanges = parsed.data.lines.find(
    (line) => line.effectiveTo && new Date(line.effectiveTo).getTime() < new Date(line.effectiveFrom).getTime()
  );
  if (invalidRanges) return jsonError("Effective To cannot be before Effective From", 400);
  if (hasOverlappingEffectiveWindows(parsed.data.lines)) {
    return jsonError("Overlapping effective date ranges found for the same SKU and quantity break", 400);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.salesPriceListLine.deleteMany({ where: { companyId, priceListId: params.id } });
      return tx.salesPriceList.update({
        where: { id: params.id },
        data: {
          customerId: parsed.data.customerId,
          code: parsed.data.code?.trim() || null,
          name: parsed.data.name.trim(),
          notes: parsed.data.notes?.trim() || null,
          active: parsed.data.active ?? true,
          lines: {
            create: parsed.data.lines.map((line) => ({
              companyId,
              skuId: line.skuId,
              unitPrice: line.unitPrice,
              discountPct: line.discountPct ?? 0,
              taxPct: line.taxPct ?? 0,
              minQty: line.minQty ?? null,
              effectiveFrom: new Date(line.effectiveFrom),
              effectiveTo: line.effectiveTo ? new Date(line.effectiveTo) : null,
              active: line.active ?? true
            }))
          }
        },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          lines: {
            include: { sku: { select: { id: true, code: true, name: true, unit: true } } },
            orderBy: [{ sku: { code: "asc" } }, { effectiveFrom: "desc" }]
          }
        }
      });
    });
    return jsonOk(updated);
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to update sales price list", 400);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const existing = await prisma.salesPriceList.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    select: { id: true }
  });
  if (!existing) return jsonError("Sales price list not found", 404);

  await prisma.salesPriceList.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), active: false }
  });
  return jsonOk({ deleted: true });
}
