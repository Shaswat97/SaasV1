const { PrismaClient } = require("@prisma/client");

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

  await prisma.role.create({
    data: {
      companyId: company.id,
      name: "Admin"
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
