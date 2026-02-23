const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

const ALL_PERMISSIONS = [
  "dashboard.view",
  "reports.view",
  "activity.view",
  "sales.view",
  "sales.create",
  "sales.confirm",
  "sales.procure",
  "sales.production",
  "sales.dispatch",
  "sales.deliver",
  "sales.invoice.create",
  "sales.payment.record",
  "purchase.view",
  "purchase.create",
  "purchase.confirm",
  "purchase.approve",
  "purchase.receive",
  "vendor.bill.record",
  "vendor.payment.record",
  "production.view",
  "production.start",
  "production.close",
  "inventory.view",
  "inventory.adjust",
  "inventory.transfer",
  "inventory.cycle_count",
  "settings.view",
  "settings.master_data",
  "settings.import",
  "settings.reset_data",
  "users.manage_roles",
  "users.manage_employees"
];

const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: ALL_PERMISSIONS,
  PROCUREMENT_MANAGER: [
    "dashboard.view",
    "reports.view",
    "activity.view",
    "purchase.view",
    "purchase.create",
    "purchase.confirm",
    "purchase.approve",
    "purchase.receive",
    "vendor.bill.record",
    "vendor.payment.record",
    "inventory.view"
  ],
  ORDER_MANAGER: [
    "dashboard.view",
    "reports.view",
    "activity.view",
    "sales.view",
    "sales.create",
    "sales.confirm",
    "sales.procure",
    "sales.production",
    "sales.dispatch",
    "sales.deliver",
    "sales.invoice.create",
    "sales.payment.record"
  ],
  ACCOUNTANT: [
    "dashboard.view",
    "reports.view",
    "activity.view",
    "sales.view",
    "sales.invoice.create",
    "sales.payment.record",
    "purchase.view",
    "vendor.bill.record",
    "vendor.payment.record",
    "inventory.view"
  ],
  NORMAL: [
    "dashboard.view",
    "reports.view",
    "activity.view",
    "sales.view",
    "purchase.view",
    "production.view",
    "inventory.view",
    "settings.view"
  ]
};

function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(pin, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.company.findFirst({ where: { deletedAt: null } });
  if (existing) {
    console.log(`Company already exists (${existing.name}). Skipping base seed.`);
    return;
  }

  const companyName = process.env.SEED_COMPANY_NAME || "Default";
  const company = await prisma.company.create({
    data: {
      name: companyName
    }
  });

  for (const roleName of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
    await prisma.role.create({
      data: {
        companyId: company.id,
        name: roleName,
        permissions: DEFAULT_ROLE_PERMISSIONS[roleName]
      }
    });
  }

  await prisma.employee.create({
    data: {
      companyId: company.id,
      code: "ADMIN",
      name: "Admin",
      pinHash: hashPin("1234"),
      pinUpdatedAt: new Date(),
      active: true,
      roles: {
        create: {
          role: {
            connect: {
              companyId_name: { companyId: company.id, name: "ADMIN" }
            }
          }
        }
      }
    }
  });

  const warehouse = await prisma.warehouse.create({
    data: {
      companyId: company.id,
      code: "WH-01",
      name: "Main Warehouse"
    }
  });

  await prisma.zone.createMany({
    data: [
      {
        companyId: company.id,
        warehouseId: warehouse.id,
        code: "RAW",
        name: "Raw Material Zone",
        type: "RAW_MATERIAL"
      },
      {
        companyId: company.id,
        warehouseId: warehouse.id,
        code: "WIP",
        name: "Processing / WIP Zone",
        type: "PROCESSING_WIP"
      },
      {
        companyId: company.id,
        warehouseId: warehouse.id,
        code: "FIN",
        name: "Finished Goods Zone",
        type: "FINISHED"
      },
      {
        companyId: company.id,
        warehouseId: warehouse.id,
        code: "SCRAP",
        name: "Scrap Zone",
        type: "SCRAP"
      },
      {
        companyId: company.id,
        warehouseId: warehouse.id,
        code: "TRANSIT",
        name: "In Transit Zone",
        type: "IN_TRANSIT"
      }
    ]
  });

  console.log(`Base seed complete for ${companyName}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
