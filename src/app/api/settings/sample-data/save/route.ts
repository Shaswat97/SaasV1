import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SAMPLE_PATH = path.join(process.cwd(), "prisma", "sample-data.json");

type SampleData = {
  vendors: Array<{
    code: string;
    name: string;
    vendorType?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    billingLine1?: string | null;
    billingLine2?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingPostalCode?: string | null;
    billingCountry?: string | null;
    shippingLine1?: string | null;
    shippingLine2?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPostalCode?: string | null;
    shippingCountry?: string | null;
  }>;
  customers: Array<{
    code: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    billingLine1?: string | null;
    billingLine2?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingPostalCode?: string | null;
    billingCountry?: string | null;
    shippingLine1?: string | null;
    shippingLine2?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPostalCode?: string | null;
    shippingCountry?: string | null;
  }>;
  employees: Array<{
    code: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    active?: boolean;
  }>;
  machines: Array<{
    code: string;
    name: string;
    model?: string | null;
    category?: string | null;
    baseCapacityPerMinute: number;
    active?: boolean;
  }>;
  skus: Array<{
    code: string;
    name: string;
    unit: string;
    type: string;
    scrapPct?: number | null;
    preferredVendorCode?: string | null;
    lastPurchasePrice?: number | null;
    standardCost?: number | null;
    manufacturingCost?: number | null;
    sellingPrice?: number | null;
    lowStockThreshold?: number | null;
    active?: boolean;
  }>;
  boms: Array<{
    finishedSkuCode: string;
    name?: string | null;
    version?: number | null;
    lines: Array<{ rawSkuCode: string; quantity: number; scrapPct?: number | null }>;
  }>;
  machineSkus: Array<{
    machineCode: string;
    skuCode: string;
    capacityPerMinute: number;
    active?: boolean;
  }>;
  vendorSkus: Array<{
    vendorCode: string;
    skuCode: string;
    lastPrice?: number | null;
  }>;
};

export async function POST() {
  const prisma = await getTenantPrisma();
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = await getDefaultCompanyId(prisma);

  try {
    const [vendors, customers, employees, machines, skus, boms, machineSkus, vendorSkus] = await Promise.all([
      prisma.vendor.findMany({ where: { companyId, deletedAt: null }, orderBy: { code: "asc" } }),
      prisma.customer.findMany({ where: { companyId, deletedAt: null }, orderBy: { code: "asc" } }),
      prisma.employee.findMany({ where: { companyId, deletedAt: null }, orderBy: { code: "asc" } }),
      prisma.machine.findMany({ where: { companyId, deletedAt: null }, orderBy: { code: "asc" } }),
      prisma.sku.findMany({
        where: { companyId, deletedAt: null },
        include: { preferredVendor: true },
        orderBy: { code: "asc" }
      }),
      prisma.bom.findMany({
        where: { companyId, deletedAt: null },
        include: {
          finishedSku: true,
          lines: {
            where: { deletedAt: null },
            include: { rawSku: true }
          }
        }
      }),
      prisma.machineSku.findMany({
        where: { companyId, deletedAt: null },
        include: { machine: true, sku: true }
      }),
      prisma.vendorSku.findMany({
        where: { companyId },
        include: { vendor: true, sku: true }
      })
    ]);

    const sample: SampleData = {
      vendors: vendors.map((vendor) => ({
        code: vendor.code,
        name: vendor.name,
        vendorType: vendor.vendorType ?? null,
        phone: vendor.phone ?? null,
        email: vendor.email ?? null,
        gstin: vendor.gstin ?? null,
        billingLine1: vendor.billingLine1 ?? null,
        billingLine2: vendor.billingLine2 ?? null,
        billingCity: vendor.billingCity ?? null,
        billingState: vendor.billingState ?? null,
        billingPostalCode: vendor.billingPostalCode ?? null,
        billingCountry: vendor.billingCountry ?? null,
        shippingLine1: vendor.shippingLine1 ?? null,
        shippingLine2: vendor.shippingLine2 ?? null,
        shippingCity: vendor.shippingCity ?? null,
        shippingState: vendor.shippingState ?? null,
        shippingPostalCode: vendor.shippingPostalCode ?? null,
        shippingCountry: vendor.shippingCountry ?? null
      })),
      customers: customers.map((customer) => ({
        code: customer.code,
        name: customer.name,
        phone: customer.phone ?? null,
        email: customer.email ?? null,
        gstin: customer.gstin ?? null,
        billingLine1: customer.billingLine1 ?? null,
        billingLine2: customer.billingLine2 ?? null,
        billingCity: customer.billingCity ?? null,
        billingState: customer.billingState ?? null,
        billingPostalCode: customer.billingPostalCode ?? null,
        billingCountry: customer.billingCountry ?? null,
        shippingLine1: customer.shippingLine1 ?? null,
        shippingLine2: customer.shippingLine2 ?? null,
        shippingCity: customer.shippingCity ?? null,
        shippingState: customer.shippingState ?? null,
        shippingPostalCode: customer.shippingPostalCode ?? null,
        shippingCountry: customer.shippingCountry ?? null
      })),
      employees: employees.map((employee) => ({
        code: employee.code,
        name: employee.name,
        phone: employee.phone ?? null,
        email: employee.email ?? null,
        active: employee.active
      })),
      machines: machines.map((machine) => ({
        code: machine.code,
        name: machine.name,
        model: machine.model ?? null,
        category: machine.category ?? null,
        baseCapacityPerMinute: machine.baseCapacityPerMinute,
        active: machine.active
      })),
      skus: skus.map((sku) => ({
        code: sku.code,
        name: sku.name,
        unit: sku.unit,
        type: sku.type,
        scrapPct: sku.scrapPct ?? null,
        preferredVendorCode: sku.preferredVendor?.code ?? null,
        lastPurchasePrice: sku.lastPurchasePrice ?? null,
        standardCost: sku.standardCost ?? null,
        manufacturingCost: sku.manufacturingCost ?? null,
        sellingPrice: sku.sellingPrice ?? null,
        lowStockThreshold: sku.lowStockThreshold ?? null,
        active: sku.active
      })),
      boms: boms
        .filter((bom) => bom.finishedSku)
        .map((bom) => ({
          finishedSkuCode: bom.finishedSku.code,
          name: bom.name ?? null,
          version: bom.version ?? null,
          lines: bom.lines
            .filter((line) => line.rawSku)
            .map((line) => ({
              rawSkuCode: line.rawSku.code,
              quantity: line.quantity,
              scrapPct: line.scrapPct ?? null
            }))
        }))
        .sort((a, b) => a.finishedSkuCode.localeCompare(b.finishedSkuCode)),
      machineSkus: machineSkus
        .filter((mapping) => mapping.machine && mapping.sku)
        .map((mapping) => ({
          machineCode: mapping.machine.code,
          skuCode: mapping.sku.code,
          capacityPerMinute: mapping.capacityPerMinute,
          active: mapping.active
        }))
        .sort((a, b) => a.machineCode.localeCompare(b.machineCode) || a.skuCode.localeCompare(b.skuCode)),
      vendorSkus: vendorSkus
        .filter((mapping) => mapping.vendor && mapping.sku)
        .map((mapping) => ({
          vendorCode: mapping.vendor.code,
          skuCode: mapping.sku.code,
          lastPrice: mapping.lastPrice ?? null
        }))
        .sort((a, b) => a.vendorCode.localeCompare(b.vendorCode) || a.skuCode.localeCompare(b.skuCode))
    };

    await fs.writeFile(SAMPLE_PATH, JSON.stringify(sample, null, 2));

    return jsonOk({
      vendors: sample.vendors.length,
      customers: sample.customers.length,
      employees: sample.employees.length,
      machines: sample.machines.length,
      skus: sample.skus.length,
      boms: sample.boms.length,
      machineSkus: sample.machineSkus.length,
      vendorSkus: sample.vendorSkus.length
    });
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to save sample data");
  }
}
