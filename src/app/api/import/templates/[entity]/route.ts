import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const templates: Record<string, string[]> = {
  vendors: [
    "code",
    "name",
    "vendorType",
    "phone",
    "email",
    "gstin",
    "billingLine1",
    "billingLine2",
    "billingCity",
    "billingState",
    "billingPostalCode",
    "billingCountry",
    "shippingLine1",
    "shippingLine2",
    "shippingCity",
    "shippingState",
    "shippingPostalCode",
    "shippingCountry",
    "active"
  ],
  customers: [
    "code",
    "name",
    "phone",
    "email",
    "gstin",
    "billingLine1",
    "billingLine2",
    "billingCity",
    "billingState",
    "billingPostalCode",
    "billingCountry",
    "shippingLine1",
    "shippingLine2",
    "shippingCity",
    "shippingState",
    "shippingPostalCode",
    "shippingCountry",
    "active"
  ],
  employees: ["code", "name", "phone", "email", "active"],
  machines: ["code", "name", "model", "category", "baseCapacityPerMinute", "active"],
  raw_skus: ["code", "name", "unit", "scrapPct", "lowStockThreshold", "lastPurchasePrice", "standardCost", "active"],
  finished_skus: ["code", "name", "unit", "manufacturingCost", "sellingPrice", "lowStockThreshold", "active"],
  warehouses: ["code", "name", "active"],
  zones: ["code", "name", "warehouseCode", "type", "active"]
};

export async function GET(_: Request, { params }: { params: { entity: string } }) {
  const entity = params.entity;
  const headers = templates[entity];
  if (!headers) {
    return jsonError("Unknown template", 404);
  }

  const csv = `${headers.join(",")}\n`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=${entity}-template.csv`
    }
  });
}
