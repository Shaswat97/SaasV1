const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

const modelOrder = [
  "company",
  "role",
  "employee",
  "employeeRole",
  "vendor",
  "customer",
  "sku",
  "vendorSku",
  "warehouse",
  "zone",
  "machine",
  "machineSku",
  "routing",
  "routingStep",
  "bom",
  "bomLine",
  "salesOrder",
  "salesOrderLine",
  "salesOrderDelivery",
  "salesInvoice",
  "salesInvoiceLine",
  "purchaseOrder",
  "purchaseOrderLine",
  "goodsReceipt",
  "goodsReceiptLine",
  "purchaseOrderAllocation",
  "stockReservation",
  "stockLedger",
  "stockBalance",
  "productionLog",
  "productionLogCrew",
  "productionLogConsumption",
  "productionLogAudit",
  "activityLog"
];

async function main() {
  const data = {};
  for (const model of modelOrder) {
    if (!prisma[model] || typeof prisma[model].findMany !== "function") {
      console.warn(`Skipping unknown model: ${model}`);
      data[model] = [];
      continue;
    }
    data[model] = await prisma[model].findMany();
  }
  const outPath = path.join(__dirname, "..", "prisma", "seed-data.json");
  fs.writeFileSync(outPath, JSON.stringify({ modelOrder, data }, null, 2));
  console.log(`Seed data exported to ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
