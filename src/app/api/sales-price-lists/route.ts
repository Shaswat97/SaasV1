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

const createSchema = z.object({
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
  const groups = new Map<string, Array<{ start: number; end: number; line: ParsedLine }>>();
  for (const line of activeLines) {
    const minQtyKey = line.minQty == null ? "default" : String(line.minQty);
    const key = `${line.skuId}::${minQtyKey}`;
    const start = new Date(line.effectiveFrom).getTime();
    const end = line.effectiveTo ? new Date(line.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
    const bucket = groups.get(key) ?? [];
    bucket.push({ start, end, line });
    groups.set(key, bucket);
  }
  for (const entries of groups.values()) {
    const sorted = [...entries].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (curr.start <= prev.end) {
        return true;
      }
    }
  }
  return false;
}

export async function GET() {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  const rows = await prisma.salesPriceList.findMany({
    where: { companyId, deletedAt: null },
    include: {
      customer: { select: { id: true, code: true, name: true } },
      lines: {
        where: { active: true },
        include: { sku: { select: { id: true, code: true, name: true, unit: true } } },
        orderBy: [{ sku: { code: "asc" } }, { effectiveFrom: "desc" }]
      }
    },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }]
  });

  return jsonOk(rows);
}

export async function POST(request: Request) {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId(prisma);
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, companyId, deletedAt: null },
    select: { id: true }
  });
  if (!customer) return jsonError("Customer not found", 404);

  const skuIds = Array.from(new Set(data.lines.map((line) => line.skuId)));
  const skus = await prisma.sku.findMany({
    where: { id: { in: skuIds }, companyId, deletedAt: null, type: "FINISHED" },
    select: { id: true }
  });
  if (skus.length !== skuIds.length) return jsonError("One or more finished SKUs are invalid", 400);

  const invalidRanges = data.lines.find(
    (line) => line.effectiveTo && new Date(line.effectiveTo).getTime() < new Date(line.effectiveFrom).getTime()
  );
  if (invalidRanges) return jsonError("Effective To cannot be before Effective From", 400);
  if (hasOverlappingEffectiveWindows(data.lines)) {
    return jsonError("Overlapping effective date ranges found for the same SKU and quantity break", 400);
  }

  try {
    const created = await prisma.salesPriceList.create({
      data: {
        companyId,
        customerId: data.customerId,
        code: data.code?.trim() || null,
        name: data.name.trim(),
        notes: data.notes?.trim() || null,
        active: data.active ?? true,
        lines: {
          create: data.lines.map((line) => ({
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
    return jsonOk(created, { status: 201 });
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to create sales price list", 400);
  }
}
