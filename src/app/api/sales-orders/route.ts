import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { buildProcurementPlan, computeAvailabilitySummary, reserveRawForSalesOrder } from "@/lib/sales-order";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

const soLineSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().positive("Unit price must be greater than 0"),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional()
});

const soSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  soNumber: z.string().optional(),
  orderDate: z.string().datetime().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(soLineSchema).min(1, "Add at least one line")
});

export async function GET() {
  const companyId = await getDefaultCompanyId();

  const orders = await prisma.salesOrder.findMany({
    where: { companyId, deletedAt: null },
    include: {
      customer: true,
      lines: { include: { sku: true } },
      deliveries: true,
      invoices: { include: { lines: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(orders);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = soSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, companyId, deletedAt: null }
  });
  if (!customer) return jsonError("Customer not found", 404);

  const skuIds = parsed.data.lines.map((line) => line.skuId);
  const skus = await prisma.sku.findMany({
    where: { id: { in: skuIds }, companyId, deletedAt: null }
  });

  if (skus.length !== skuIds.length) {
    return jsonError("One or more SKUs are invalid", 400);
  }
  if (skus.some((sku) => sku.type !== "FINISHED")) {
    return jsonError("Sales order lines must reference FINISHED SKUs", 400);
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.salesOrder.create({
      data: {
        companyId,
        customerId: parsed.data.customerId,
        soNumber: parsed.data.soNumber,
        status: "QUOTE",
        orderDate: parsed.data.orderDate ? new Date(parsed.data.orderDate) : undefined,
        currency: parsed.data.currency ?? "INR",
        notes: parsed.data.notes,
        lines: {
          create: parsed.data.lines.map((line) => ({
            skuId: line.skuId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPct: line.discountPct ?? 0,
            taxPct: line.taxPct ?? 0
          }))
        }
      },
      include: {
        customer: true,
        lines: { include: { sku: true } }
      }
    });

    const availability = await computeAvailabilitySummary({
      companyId,
      lines: created.lines.map((line) => ({
        id: line.id,
        skuId: line.skuId,
        quantity: line.quantity,
        deliveredQty: line.deliveredQty
      })),
      tx
    });

    const hasShortage = availability.raw.some((raw) => raw.shortageQty > 0);
    if (!hasShortage) {
      await reserveRawForSalesOrder({ companyId, availability, tx });
      return tx.salesOrder.update({
        where: { id: created.id },
        data: { status: "CONFIRMED" },
        include: { customer: true, lines: { include: { sku: true } } }
      });
    }

    return created;
  });

  const availability = await computeAvailabilitySummary({
    companyId,
    lines: order.lines.map((line) => ({
      id: line.id,
      skuId: line.skuId,
      quantity: line.quantity,
      deliveredQty: line.deliveredQty
    })),
    excludeSoLineIds: order.lines.map((line) => line.id)
  });
  const procurementPlan = await buildProcurementPlan({
    companyId,
    lines: order.lines.map((line) => ({
      id: line.id,
      skuId: line.skuId,
      quantity: line.quantity,
      deliveredQty: line.deliveredQty
    })),
    availability,
    excludeSoLineIds: order.lines.map((line) => line.id)
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "CREATE",
    entityType: "Sales Order",
    entityId: order.id,
    summary: `Created sales order ${order.soNumber ?? order.id} (${order.status}).`
  });

  return jsonOk({ ...order, availability, procurementPlan }, { status: 201 });
}
