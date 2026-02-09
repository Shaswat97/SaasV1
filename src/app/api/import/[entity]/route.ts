import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { recordActivity } from "@/lib/activity";
import { getAdminContext } from "@/lib/permissions";
import { parseCsv } from "@/lib/csv";

type ImportError = {
  row: number;
  field?: string;
  message: string;
};

const templateHeaders: Record<string, string[]> = {
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

const zoneTypes = new Set(["RAW_MATERIAL", "PRODUCTION", "FINISHED", "SCRAP", "IN_TRANSIT"]);

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function parseNumber(value: string | undefined | null) {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseBool(value: string | undefined | null, fallback = true) {
  if (!value || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function buildRowMap(headers: string[], row: string[]) {
  const map = new Map<string, string>();
  headers.forEach((header, index) => {
    map.set(normalizeHeader(header), row[index]?.trim() ?? "");
  });
  return map;
}

function requiredHeaders(entity: string) {
  return templateHeaders[entity]?.filter((header) =>
    ["code", "name", "unit", "baseCapacityPerMinute", "warehouseCode", "type"].includes(header)
  );
}

function emptyRow(row: string[]) {
  return row.every((value) => value.trim() === "");
}

export async function POST(request: Request, { params }: { params: { entity: string } }) {
  const entity = params.entity;
  const headers = templateHeaders[entity];
  if (!headers) {
    return jsonError("Unknown import type", 404);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("CSV file is required");
  }

  const text = await file.text();
  const parsed = parseCsv(text);
  if (!parsed.headers.length) {
    return jsonError("CSV headers are missing");
  }

  const normalizedHeaders = parsed.headers.map(normalizeHeader);
  const headerSet = new Set(normalizedHeaders);
  const missing = (requiredHeaders(entity) ?? []).filter((header) => !headerSet.has(normalizeHeader(header)));
  if (missing.length) {
    return jsonError(`Missing required headers: ${missing.join(", ")}`);
  }

  const { companyId, actorName, actorEmployeeId, isAdmin } = await getAdminContext(request);
  if (!isAdmin) {
    return jsonError("Admin role required. Select an Admin in Active User.", 403);
  }

  const errors: ImportError[] = [];
  let imported = 0;
  const seenCodes = new Set<string>();

  const duplicateSkuMessage =
    "Duplicate code. To adjust inventory, use Inventory → Cycle Count (Admin only).";

  try {
    if (entity === "vendors") {
      const existing = new Set(
        (await prisma.vendor.findMany({ where: { companyId }, select: { code: true } })).map((row) => row.code)
      );
      for (let index = 0; index < parsed.rows.length; index += 1) {
        const row = parsed.rows[index];
        if (emptyRow(row)) continue;
        const rowMap = buildRowMap(parsed.headers, row);
        const code = rowMap.get("code")?.trim() ?? "";
        const name = rowMap.get("name")?.trim() ?? "";
        const vendorTypeRaw = rowMap.get("vendortype")?.trim().toUpperCase();
        const vendorType = vendorTypeRaw || "RAW";

        if (!code || !name) {
          errors.push({ row: index + 2, field: "code/name", message: "Code and name are required." });
          continue;
        }
        if (seenCodes.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code in file." });
          continue;
        }
        if (existing.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code (already exists)." });
          continue;
        }
        if (!["RAW", "SUBCONTRACT"].includes(vendorType)) {
          errors.push({ row: index + 2, field: "vendorType", message: "Vendor type must be RAW or SUBCONTRACT." });
          continue;
        }

        seenCodes.add(code);
        await prisma.vendor.create({
          data: {
            companyId,
            code,
            name,
            vendorType,
            phone: rowMap.get("phone") || undefined,
            email: rowMap.get("email") || undefined,
            gstin: rowMap.get("gstin") || undefined,
            billingLine1: rowMap.get("billingline1") || undefined,
            billingLine2: rowMap.get("billingline2") || undefined,
            billingCity: rowMap.get("billingcity") || undefined,
            billingState: rowMap.get("billingstate") || undefined,
            billingPostalCode: rowMap.get("billingpostalcode") || undefined,
            billingCountry: rowMap.get("billingcountry") || undefined,
            shippingLine1: rowMap.get("shippingline1") || undefined,
            shippingLine2: rowMap.get("shippingline2") || undefined,
            shippingCity: rowMap.get("shippingcity") || undefined,
            shippingState: rowMap.get("shippingstate") || undefined,
            shippingPostalCode: rowMap.get("shippingpostalcode") || undefined,
            shippingCountry: rowMap.get("shippingcountry") || undefined,
            active: parseBool(rowMap.get("active"))
          }
        });
        imported += 1;
      }
    } else if (entity === "customers") {
      const existing = new Set(
        (await prisma.customer.findMany({ where: { companyId }, select: { code: true } })).map((row) => row.code)
      );
      for (let index = 0; index < parsed.rows.length; index += 1) {
        const row = parsed.rows[index];
        if (emptyRow(row)) continue;
        const rowMap = buildRowMap(parsed.headers, row);
        const code = rowMap.get("code")?.trim() ?? "";
        const name = rowMap.get("name")?.trim() ?? "";

        if (!code || !name) {
          errors.push({ row: index + 2, field: "code/name", message: "Code and name are required." });
          continue;
        }
        if (seenCodes.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code in file." });
          continue;
        }
        if (existing.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code (already exists)." });
          continue;
        }

        seenCodes.add(code);
        await prisma.customer.create({
          data: {
            companyId,
            code,
            name,
            phone: rowMap.get("phone") || undefined,
            email: rowMap.get("email") || undefined,
            gstin: rowMap.get("gstin") || undefined,
            billingLine1: rowMap.get("billingline1") || undefined,
            billingLine2: rowMap.get("billingline2") || undefined,
            billingCity: rowMap.get("billingcity") || undefined,
            billingState: rowMap.get("billingstate") || undefined,
            billingPostalCode: rowMap.get("billingpostalcode") || undefined,
            billingCountry: rowMap.get("billingcountry") || undefined,
            shippingLine1: rowMap.get("shippingline1") || undefined,
            shippingLine2: rowMap.get("shippingline2") || undefined,
            shippingCity: rowMap.get("shippingcity") || undefined,
            shippingState: rowMap.get("shippingstate") || undefined,
            shippingPostalCode: rowMap.get("shippingpostalcode") || undefined,
            shippingCountry: rowMap.get("shippingcountry") || undefined,
            active: parseBool(rowMap.get("active"))
          }
        });
        imported += 1;
      }
    } else if (entity === "employees") {
      const existing = new Set(
        (await prisma.employee.findMany({ where: { companyId }, select: { code: true } })).map((row) => row.code)
      );
      for (let index = 0; index < parsed.rows.length; index += 1) {
        const row = parsed.rows[index];
        if (emptyRow(row)) continue;
        const rowMap = buildRowMap(parsed.headers, row);
        const code = rowMap.get("code")?.trim() ?? "";
        const name = rowMap.get("name")?.trim() ?? "";

        if (!code || !name) {
          errors.push({ row: index + 2, field: "code/name", message: "Code and name are required." });
          continue;
        }
        if (seenCodes.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code in file." });
          continue;
        }
        if (existing.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code (already exists)." });
          continue;
        }

        seenCodes.add(code);
        await prisma.employee.create({
          data: {
            companyId,
            code,
            name,
            phone: rowMap.get("phone") || undefined,
            email: rowMap.get("email") || undefined,
            active: parseBool(rowMap.get("active"))
          }
        });
        imported += 1;
      }
    } else if (entity === "machines") {
      const existing = new Set(
        (await prisma.machine.findMany({ where: { companyId }, select: { code: true } })).map((row) => row.code)
      );
      for (let index = 0; index < parsed.rows.length; index += 1) {
        const row = parsed.rows[index];
        if (emptyRow(row)) continue;
        const rowMap = buildRowMap(parsed.headers, row);
        const code = rowMap.get("code")?.trim() ?? "";
        const name = rowMap.get("name")?.trim() ?? "";
        const baseCapacity = parseNumber(rowMap.get("basecapacityperminute"));

        if (!code || !name || baseCapacity == null) {
          errors.push({
            row: index + 2,
            field: "code/name/baseCapacityPerMinute",
            message: "Code, name, and baseCapacityPerMinute are required."
          });
          continue;
        }
        if (seenCodes.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code in file." });
          continue;
        }
        if (existing.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code (already exists)." });
          continue;
        }

        seenCodes.add(code);
        await prisma.machine.create({
          data: {
            companyId,
            code,
            name,
            model: rowMap.get("model") || undefined,
            category: rowMap.get("category") || undefined,
            baseCapacityPerMinute: baseCapacity,
            active: parseBool(rowMap.get("active"))
          }
        });
        imported += 1;
      }
    } else if (entity === "raw_skus" || entity === "finished_skus") {
      const existing = new Set(
        (await prisma.sku.findMany({ where: { companyId }, select: { code: true } })).map((row) => row.code)
      );
      for (let index = 0; index < parsed.rows.length; index += 1) {
        const row = parsed.rows[index];
        if (emptyRow(row)) continue;
        const rowMap = buildRowMap(parsed.headers, row);
        const code = rowMap.get("code")?.trim() ?? "";
        const name = rowMap.get("name")?.trim() ?? "";
        const unit = rowMap.get("unit")?.trim() ?? "";

        if (!code || !name || !unit) {
          errors.push({ row: index + 2, field: "code/name/unit", message: "Code, name, and unit are required." });
          continue;
        }
        if (seenCodes.has(code)) {
          errors.push({ row: index + 2, field: "code", message: duplicateSkuMessage });
          continue;
        }
        if (existing.has(code)) {
          errors.push({ row: index + 2, field: "code", message: duplicateSkuMessage });
          continue;
        }

        seenCodes.add(code);
        await prisma.sku.create({
          data: {
            companyId,
            code,
            name,
            unit,
            type: entity === "raw_skus" ? "RAW" : "FINISHED",
            scrapPct: parseNumber(rowMap.get("scrappct")) ?? undefined,
            lowStockThreshold: parseNumber(rowMap.get("lowstockthreshold")) ?? undefined,
            lastPurchasePrice: parseNumber(rowMap.get("lastpurchaseprice")) ?? undefined,
            standardCost: parseNumber(rowMap.get("standardcost")) ?? undefined,
            manufacturingCost: parseNumber(rowMap.get("manufacturingcost")) ?? undefined,
            sellingPrice: parseNumber(rowMap.get("sellingprice")) ?? undefined,
            active: parseBool(rowMap.get("active"))
          }
        });
        imported += 1;
      }
    } else if (entity === "warehouses") {
      const existing = new Set(
        (await prisma.warehouse.findMany({ where: { companyId }, select: { code: true } })).map((row) => row.code)
      );
      for (let index = 0; index < parsed.rows.length; index += 1) {
        const row = parsed.rows[index];
        if (emptyRow(row)) continue;
        const rowMap = buildRowMap(parsed.headers, row);
        const code = rowMap.get("code")?.trim() ?? "";
        const name = rowMap.get("name")?.trim() ?? "";

        if (!code || !name) {
          errors.push({ row: index + 2, field: "code/name", message: "Code and name are required." });
          continue;
        }
        if (seenCodes.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code in file." });
          continue;
        }
        if (existing.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code (already exists)." });
          continue;
        }

        seenCodes.add(code);
        await prisma.warehouse.create({
          data: {
            companyId,
            code,
            name,
            active: parseBool(rowMap.get("active"))
          }
        });
        imported += 1;
      }
    } else if (entity === "zones") {
      const existing = new Set(
        (await prisma.zone.findMany({ where: { companyId }, select: { code: true } })).map((row) => row.code)
      );
      const warehouseMap = new Map(
        (await prisma.warehouse.findMany({ where: { companyId }, select: { id: true, code: true } })).map((row) => [
          row.code,
          row.id
        ])
      );

      for (let index = 0; index < parsed.rows.length; index += 1) {
        const row = parsed.rows[index];
        if (emptyRow(row)) continue;
        const rowMap = buildRowMap(parsed.headers, row);
        const code = rowMap.get("code")?.trim() ?? "";
        const name = rowMap.get("name")?.trim() ?? "";
        const warehouseCode = rowMap.get("warehousecode")?.trim() ?? "";
        const type = rowMap.get("type")?.trim().toUpperCase() ?? "";

        if (!code || !name || !warehouseCode || !type) {
          errors.push({
            row: index + 2,
            field: "code/name/warehouseCode/type",
            message: "Code, name, warehouseCode, and type are required."
          });
          continue;
        }
        if (seenCodes.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code in file." });
          continue;
        }
        if (existing.has(code)) {
          errors.push({ row: index + 2, field: "code", message: "Duplicate code (already exists)." });
          continue;
        }
        if (!warehouseMap.has(warehouseCode)) {
          errors.push({ row: index + 2, field: "warehouseCode", message: "Warehouse code not found." });
          continue;
        }
        if (!zoneTypes.has(type)) {
          errors.push({
            row: index + 2,
            field: "type",
            message: "Zone type must be RAW_MATERIAL, PRODUCTION, FINISHED, SCRAP, or IN_TRANSIT."
          });
          continue;
        }

        seenCodes.add(code);
        await prisma.zone.create({
          data: {
            companyId,
            warehouseId: warehouseMap.get(warehouseCode) as string,
            code,
            name,
            type,
            active: parseBool(rowMap.get("active"))
          }
        });
        imported += 1;
      }
    }

    const failed = errors.length;
    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Import",
      entityId: entity,
      summary: `Imported ${entity}: ${imported} rows (${failed} failed).`
    });

    return jsonOk({ entity, imported, failed, errors });
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to import CSV");
  }
}
