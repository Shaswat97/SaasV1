const crypto = require("crypto");
const { Client } = require("pg");
const { execSync } = require("child_process");

function parseArgs() {
  const args = process.argv.slice(2);
  const output = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[i + 1];
    output[key] = value;
    i += 1;
  }
  return output;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function assertIdentifier(value, label) {
  if (!/^[a-z0-9_]+$/.test(value)) {
    throw new Error(`${label} must contain only lowercase letters, numbers, and underscores.`);
  }
}

function escapeSqlString(value) {
  return value.replace(/'/g, "''");
}

async function main() {
  const args = parseArgs();
  const subdomain = args.subdomain || args.sub;
  const companyName = args.company || args.name;

  if (!subdomain || !companyName) {
    throw new Error("Usage: node scripts/provision-tenant.js --subdomain ragindustries --company \"RAG Industries\"");
  }

  const slug = slugify(subdomain);
  const dbName = args.dbName || `tenant_${slug}`;
  const dbUser = args.dbUser || `tenant_${slug}_user`;
  const dbPassword = args.dbPass || crypto.randomBytes(18).toString("base64url");

  assertIdentifier(dbName, "dbName");
  assertIdentifier(dbUser, "dbUser");

  const adminUrl = process.env.POSTGRES_ADMIN_URL;
  const registryUrl = process.env.TENANT_REGISTRY_URL;
  if (!adminUrl) throw new Error("POSTGRES_ADMIN_URL is required to create tenant databases.");
  if (!registryUrl) throw new Error("TENANT_REGISTRY_URL is required to register tenants.");

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  const safePassword = escapeSqlString(dbPassword);
  try {
    await admin.query(`CREATE ROLE "${dbUser}" WITH LOGIN PASSWORD '${safePassword}'`);
  } catch (error) {
    if (error && error.code !== "42710") throw error;
  }

  try {
    await admin.query(`CREATE DATABASE "${dbName}" OWNER "${dbUser}"`);
  } catch (error) {
    if (error && error.code !== "42P04") throw error;
  }

  await admin.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}"`);
  await admin.end();

  const adminUrlObj = new URL(adminUrl);
  const host = adminUrlObj.hostname || "localhost";
  const port = adminUrlObj.port || "5432";
  const tenantDbUrl = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${host}:${port}/${dbName}?schema=public`;

  const env = { ...process.env, DATABASE_URL: tenantDbUrl, SEED_COMPANY_NAME: companyName };

  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("node scripts/seed-base.js", { stdio: "inherit", env });

  const registry = new Client({ connectionString: registryUrl });
  await registry.connect();
  await registry.query(`
    CREATE TABLE IF NOT EXISTS tenant_registry (
      id TEXT PRIMARY KEY,
      subdomain TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      db_name TEXT NOT NULL,
      db_user TEXT NOT NULL,
      db_password TEXT NOT NULL,
      db_host TEXT NOT NULL,
      db_port INTEGER NOT NULL DEFAULT 5432,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const registryEntry = {
    id: crypto.randomUUID(),
    subdomain,
    companyName,
    dbName,
    dbUser,
    dbPassword,
    dbHost: host,
    dbPort: Number(port || 5432)
  };
  await registry.query(
    `INSERT INTO tenant_registry (id, subdomain, company_name, db_name, db_user, db_password, db_host, db_port)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (subdomain) DO NOTHING`,
    [
      registryEntry.id,
      registryEntry.subdomain,
      registryEntry.companyName,
      registryEntry.dbName,
      registryEntry.dbUser,
      registryEntry.dbPassword,
      registryEntry.dbHost,
      registryEntry.dbPort
    ]
  );
  await registry.end();

  console.log("\nTenant provisioned successfully.");
  console.log(`Subdomain: ${subdomain}`);
  console.log(`DB name: ${dbName}`);
  console.log(`DB user: ${dbUser}`);
  console.log(`DB password: ${dbPassword}`);
  console.log(`DATABASE_URL=${tenantDbUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
