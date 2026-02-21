const { PrismaClient } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

const prisma = new PrismaClient();

function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(pin, salt, 64).toString("hex");
  return `scrypt:${salt}:${digest}`; // Adjusted format to match common scrypt storage if needed, but checking code uses standard scrypt check usually.
  // Wait, the seed-base.js used: `scrypt$${salt}$${digest}`
  // I should match that format.
}

function hashPinCorrect(pin) {
    const salt = randomBytes(16).toString("hex");
    const digest = scryptSync(pin, salt, 64).toString("hex");
    return `scrypt$${salt}$${digest}`;
}

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("No company found. Database might be empty.");
    return;
  }
  console.log(`Found company: ${company.name} (${company.id})`);

  // Ensure ADMIN role
  let adminRole = await prisma.role.findFirst({
    where: { companyId: company.id, name: "ADMIN" }
  });

  if (!adminRole) {
    console.log("Creating ADMIN role...");
    // We need permissions. Borrowing from seed-base.js or just giving empty for now (app might require specific ones)
    // Actually, let's just assume the role exists from seed-data.json (it did have roles).
    // If not, we create basic one.
    adminRole = await prisma.role.create({
      data: {
        companyId: company.id,
        name: "ADMIN",
        permissions: [] 
      }
    });
  } else {
    console.log(`Found ADMIN role: ${adminRole.id}`);
  }

  // Create/Update Admin Employee
  const empCode = "ADMIN";
  const pin = "1234";
  
  const existing = await prisma.employee.findUnique({
    where: { companyId_code: { companyId: company.id, code: empCode } }
  });

  if (existing) {
    console.log(`Employee ${empCode} exists. Updating PIN...`);
    await prisma.employee.update({
      where: { id: existing.id },
      data: {
        pinHash: hashPinCorrect(pin),
        pinUpdatedAt: new Date()
      }
    });
  } else {
    console.log(`Creating Employee ${empCode}...`);
    await prisma.employee.create({
      data: {
        companyId: company.id,
        code: empCode,
        name: "System Admin",
        pinHash: hashPinCorrect(pin),
        pinUpdatedAt: new Date(),
        active: true,
        roles: {
          create: {
            roleId: adminRole.id
          }
        }
      }
    });
  }
  
  console.log("-----------------------------------------");
  console.log(`Login Credentials:`);
  console.log(`Code: ${empCode}`);
  console.log(`PIN:  ${pin}`);
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
