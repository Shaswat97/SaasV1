import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { promises as fs } from "fs";
import path from "path";

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

const defaultSample: SampleData = {
  vendors: [
    { code: "VEND-01", name: "Allied Metals", vendorType: "RAW", phone: "+91 98000 11111" },
    { code: "VEND-02", name: "Bharat Polymers", vendorType: "RAW", phone: "+91 98000 22222" }
  ],
  customers: [
    { code: "CUST-01", name: "Orion Auto", phone: "+91 97000 11111" },
    { code: "CUST-02", name: "Nova Tools", phone: "+91 97000 22222" }
  ],
  employees: [
    { code: "EMP-01", name: "Riya Sharma", email: "riya@ragindustries.in" },
    { code: "EMP-02", name: "Arjun Mehta" },
    { code: "EMP-03", name: "Neha Iyer" },
    { code: "EMP-04", name: "Rakesh Gupta" },
    { code: "EMP-05", name: "Kiran Joshi" }
  ],
  machines: [
    { code: "M-01", name: "CNC Lathe", model: "CLX-250", category: "Machining", baseCapacityPerMinute: 2.5 },
    { code: "M-02", name: "Hydraulic Press", model: "HP-400", category: "Forming", baseCapacityPerMinute: 1.2 }
  ],
  skus: [
    { code: "RM-01", name: "Steel Rod 12mm", unit: "KG", type: "RAW", preferredVendorCode: "VEND-01", lastPurchasePrice: 86, lowStockThreshold: 120 },
    { code: "RM-02", name: "Alloy Sheet 1.5mm", unit: "KG", type: "RAW", preferredVendorCode: "VEND-01", lastPurchasePrice: 112, lowStockThreshold: 80 },
    { code: "RM-03", name: "Polymer Resin", unit: "KG", type: "RAW", preferredVendorCode: "VEND-02", lastPurchasePrice: 68, lowStockThreshold: 60 },
    { code: "FG-01", name: "Precision Housing", unit: "PCS", type: "FINISHED", sellingPrice: 420, lowStockThreshold: 20 },
    { code: "FG-02", name: "Hydraulic Bracket", unit: "PCS", type: "FINISHED", sellingPrice: 540, lowStockThreshold: 15 }
  ],
  boms: [],
  machineSkus: []
  ,
  vendorSkus: [
    { vendorCode: "VEND-01", skuCode: "RM-01", lastPrice: 86 },
    { vendorCode: "VEND-01", skuCode: "RM-02", lastPrice: 112 },
    { vendorCode: "VEND-02", skuCode: "RM-03", lastPrice: 68 }
  ]
};

async function readSampleFile(): Promise<SampleData | null> {
  try {
    const raw = await fs.readFile(SAMPLE_PATH, "utf-8");
    return JSON.parse(raw) as SampleData;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  try {
    const snapshot = await readSampleFile();
    const sample = snapshot ?? defaultSample;

    const result = await prisma.$transaction(async (tx) => {
      const adminRole = await tx.role.upsert({
        where: { companyId_name: { companyId, name: "ADMIN" } },
        update: {},
        create: { companyId, name: "ADMIN" }
      });

      const vendors = await Promise.all(
        sample.vendors.map((vendor) =>
          tx.vendor.upsert({
            where: { companyId_code: { companyId, code: vendor.code } },
            update: {
              name: vendor.name,
              vendorType: vendor.vendorType ?? "RAW",
              phone: vendor.phone ?? undefined,
              email: vendor.email ?? undefined,
              gstin: vendor.gstin ?? undefined,
              billingLine1: vendor.billingLine1 ?? undefined,
              billingLine2: vendor.billingLine2 ?? undefined,
              billingCity: vendor.billingCity ?? undefined,
              billingState: vendor.billingState ?? undefined,
              billingPostalCode: vendor.billingPostalCode ?? undefined,
              billingCountry: vendor.billingCountry ?? undefined,
              shippingLine1: vendor.shippingLine1 ?? undefined,
              shippingLine2: vendor.shippingLine2 ?? undefined,
              shippingCity: vendor.shippingCity ?? undefined,
              shippingState: vendor.shippingState ?? undefined,
              shippingPostalCode: vendor.shippingPostalCode ?? undefined,
              shippingCountry: vendor.shippingCountry ?? undefined
            },
            create: {
              companyId,
              code: vendor.code,
              name: vendor.name,
              vendorType: vendor.vendorType ?? "RAW",
              phone: vendor.phone ?? undefined,
              email: vendor.email ?? undefined,
              gstin: vendor.gstin ?? undefined,
              billingLine1: vendor.billingLine1 ?? undefined,
              billingLine2: vendor.billingLine2 ?? undefined,
              billingCity: vendor.billingCity ?? undefined,
              billingState: vendor.billingState ?? undefined,
              billingPostalCode: vendor.billingPostalCode ?? undefined,
              billingCountry: vendor.billingCountry ?? undefined,
              shippingLine1: vendor.shippingLine1 ?? undefined,
              shippingLine2: vendor.shippingLine2 ?? undefined,
              shippingCity: vendor.shippingCity ?? undefined,
              shippingState: vendor.shippingState ?? undefined,
              shippingPostalCode: vendor.shippingPostalCode ?? undefined,
              shippingCountry: vendor.shippingCountry ?? undefined
            }
          })
        )
      );

      const customers = await Promise.all(
        sample.customers.map((customer) =>
          tx.customer.upsert({
            where: { companyId_code: { companyId, code: customer.code } },
            update: {
              name: customer.name,
              phone: customer.phone ?? undefined,
              email: customer.email ?? undefined,
              gstin: customer.gstin ?? undefined,
              billingLine1: customer.billingLine1 ?? undefined,
              billingLine2: customer.billingLine2 ?? undefined,
              billingCity: customer.billingCity ?? undefined,
              billingState: customer.billingState ?? undefined,
              billingPostalCode: customer.billingPostalCode ?? undefined,
              billingCountry: customer.billingCountry ?? undefined,
              shippingLine1: customer.shippingLine1 ?? undefined,
              shippingLine2: customer.shippingLine2 ?? undefined,
              shippingCity: customer.shippingCity ?? undefined,
              shippingState: customer.shippingState ?? undefined,
              shippingPostalCode: customer.shippingPostalCode ?? undefined,
              shippingCountry: customer.shippingCountry ?? undefined
            },
            create: {
              companyId,
              code: customer.code,
              name: customer.name,
              phone: customer.phone ?? undefined,
              email: customer.email ?? undefined,
              gstin: customer.gstin ?? undefined,
              billingLine1: customer.billingLine1 ?? undefined,
              billingLine2: customer.billingLine2 ?? undefined,
              billingCity: customer.billingCity ?? undefined,
              billingState: customer.billingState ?? undefined,
              billingPostalCode: customer.billingPostalCode ?? undefined,
              billingCountry: customer.billingCountry ?? undefined,
              shippingLine1: customer.shippingLine1 ?? undefined,
              shippingLine2: customer.shippingLine2 ?? undefined,
              shippingCity: customer.shippingCity ?? undefined,
              shippingState: customer.shippingState ?? undefined,
              shippingPostalCode: customer.shippingPostalCode ?? undefined,
              shippingCountry: customer.shippingCountry ?? undefined
            }
          })
        )
      );

      const employees = await Promise.all(
        sample.employees.map((employee) =>
          tx.employee.upsert({
            where: { companyId_code: { companyId, code: employee.code } },
            update: {
              name: employee.name,
              phone: employee.phone ?? undefined,
              email: employee.email ?? undefined,
              active: employee.active ?? true
            },
            create: {
              companyId,
              code: employee.code,
              name: employee.name,
              phone: employee.phone ?? undefined,
              email: employee.email ?? undefined,
              active: employee.active ?? true
            }
          })
        )
      );

      await Promise.all(
        employees.map((employee) =>
          tx.employeeRole.upsert({
            where: { employeeId_roleId: { employeeId: employee.id, roleId: adminRole.id } },
            update: {},
            create: { employeeId: employee.id, roleId: adminRole.id }
          })
        )
      );

      const machines = await Promise.all(
        sample.machines.map((machine) =>
          tx.machine.upsert({
            where: { companyId_code: { companyId, code: machine.code } },
            update: {
              name: machine.name,
              model: machine.model ?? undefined,
              category: machine.category ?? undefined,
              baseCapacityPerMinute: machine.baseCapacityPerMinute,
              active: machine.active ?? true
            },
            create: {
              companyId,
              code: machine.code,
              name: machine.name,
              model: machine.model ?? undefined,
              category: machine.category ?? undefined,
              baseCapacityPerMinute: machine.baseCapacityPerMinute,
              active: machine.active ?? true
            }
          })
        )
      );

      const vendorMap = new Map(vendors.map((vendor) => [vendor.code, vendor]));

      const skus = await Promise.all(
        sample.skus.map((sku) => {
          const preferredVendorId = sku.preferredVendorCode ? vendorMap.get(sku.preferredVendorCode)?.id : undefined;
          return tx.sku.upsert({
            where: { companyId_code: { companyId, code: sku.code } },
            update: {
              name: sku.name,
              unit: sku.unit,
              type: sku.type,
              scrapPct: sku.scrapPct ?? undefined,
              preferredVendorId,
              lastPurchasePrice: sku.lastPurchasePrice ?? undefined,
              standardCost: sku.standardCost ?? undefined,
              manufacturingCost: sku.manufacturingCost ?? undefined,
              sellingPrice: sku.sellingPrice ?? undefined,
              lowStockThreshold: sku.lowStockThreshold ?? undefined,
              active: sku.active ?? true
            },
            create: {
              companyId,
              code: sku.code,
              name: sku.name,
              unit: sku.unit,
              type: sku.type,
              scrapPct: sku.scrapPct ?? undefined,
              preferredVendorId,
              lastPurchasePrice: sku.lastPurchasePrice ?? undefined,
              standardCost: sku.standardCost ?? undefined,
              manufacturingCost: sku.manufacturingCost ?? undefined,
              sellingPrice: sku.sellingPrice ?? undefined,
              lowStockThreshold: sku.lowStockThreshold ?? undefined,
              active: sku.active ?? true
            }
          });
        })
      );

      const skuMap = new Map(skus.map((sku) => [sku.code, sku]));
      const machineMap = new Map(machines.map((machine) => [machine.code, machine]));

      for (const bom of sample.boms) {
        const finished = skuMap.get(bom.finishedSkuCode);
        if (!finished) continue;
        const existing = await tx.bom.findFirst({
          where: { companyId, finishedSkuId: finished.id, deletedAt: null },
          orderBy: { version: "desc" }
        });
        let bomId = existing?.id;
        if (!bomId) {
          const created = await tx.bom.create({
            data: {
              companyId,
              finishedSkuId: finished.id,
              name: bom.name ?? undefined,
              version: bom.version ?? undefined
            }
          });
          bomId = created.id;
        } else {
          await tx.bom.update({
            where: { id: bomId },
            data: { name: bom.name ?? undefined, version: bom.version ?? undefined }
          });
          await tx.bomLine.deleteMany({ where: { bomId } });
        }

        if (bom.lines.length) {
          await tx.bomLine.createMany({
            data: bom.lines
              .map((line) => {
                const rawSku = skuMap.get(line.rawSkuCode);
                if (!rawSku) return null;
                return {
                  bomId,
                  rawSkuId: rawSku.id,
                  quantity: line.quantity,
                  scrapPct: line.scrapPct ?? null
                };
              })
              .filter(Boolean) as Array<{
              bomId: string;
              rawSkuId: string;
              quantity: number;
              scrapPct: number | null;
            }>
          });
        }
      }

      for (const mapping of sample.machineSkus) {
        const machine = machineMap.get(mapping.machineCode);
        const sku = skuMap.get(mapping.skuCode);
        if (!machine || !sku) continue;
        await tx.machineSku.upsert({
          where: { companyId_machineId_skuId: { companyId, machineId: machine.id, skuId: sku.id } },
          update: {
            capacityPerMinute: mapping.capacityPerMinute,
            active: mapping.active ?? true
          },
          create: {
            companyId,
            machineId: machine.id,
            skuId: sku.id,
            capacityPerMinute: mapping.capacityPerMinute,
            active: mapping.active ?? true
          }
        });
      }

      const vendorSkuSeed =
        sample.vendorSkus && sample.vendorSkus.length
          ? sample.vendorSkus
          : sample.skus
              .filter((sku) => sku.preferredVendorCode)
              .map((sku) => ({
                vendorCode: sku.preferredVendorCode as string,
                skuCode: sku.code,
                lastPrice: sku.lastPurchasePrice ?? null
              }));

      for (const mapping of vendorSkuSeed) {
        const vendor = vendorMap.get(mapping.vendorCode);
        const sku = skuMap.get(mapping.skuCode);
        if (!vendor || !sku) continue;
        if ((vendor.vendorType ?? "RAW") === "RAW" && sku.type !== "RAW") continue;
        if ((vendor.vendorType ?? "RAW") === "SUBCONTRACT" && sku.type !== "FINISHED") continue;
        await tx.vendorSku.upsert({
          where: { vendorId_skuId: { vendorId: vendor.id, skuId: sku.id } },
          update: { lastPrice: mapping.lastPrice ?? undefined },
          create: {
            companyId,
            vendorId: vendor.id,
            skuId: sku.id,
            lastPrice: mapping.lastPrice ?? undefined
          }
        });
      }

      return {
        vendors: vendors.length,
        customers: customers.length,
        employees: employees.length,
        machines: machines.length,
        rawSkus: skus.filter((sku) => sku.type === "RAW").length,
        finishedSkus: skus.filter((sku) => sku.type === "FINISHED").length
      };
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Company",
      entityId: companyId,
      summary: "Loaded sample data."
    });

    return jsonOk(result);
  } catch (error: any) {
    return jsonError(error.message ?? "Failed to load sample data");
  }
}
