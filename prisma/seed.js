const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const seedPath = path.join(__dirname, "seed-data.json");

function isIsoDate(value) {
  return typeof value === "string" && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function reviveDates(value) {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === "object") {
    const output = {};
    Object.entries(value).forEach(([key, val]) => {
      if (isIsoDate(val)) {
        output[key] = new Date(val);
      } else if (Array.isArray(val) || (val && typeof val === "object")) {
        output[key] = reviveDates(val);
      } else {
        output[key] = val;
      }
    });
    return output;
  }
  return value;
}

async function main() {
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed data not found at ${seedPath}`);
  }

  const payload = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  const modelOrder = payload.modelOrder || [];
  const data = payload.data || {};

  // Delete in reverse order to satisfy foreign keys
  for (const model of [...modelOrder].reverse()) {
    if (!prisma[model] || typeof prisma[model].deleteMany !== "function") continue;
    await prisma[model].deleteMany();
  }

  // Insert in forward order
  for (const model of modelOrder) {
    if (!prisma[model] || typeof prisma[model].createMany !== "function") continue;
    const rows = reviveDates(data[model] || []);
    if (!rows.length) continue;
    await prisma[model].createMany({ data: rows });
  }

  console.log("Seeded database from snapshot.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
