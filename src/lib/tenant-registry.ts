import { Client } from "pg";

export type TenantRegistryRow = {
  id: string;
  subdomain: string;
  companyName: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbHost: string;
  dbPort: number;
  createdAt: Date;
};

const REGISTRY_TABLE_SQL = `
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
`;

function getRegistryUrl() {
  const url = process.env.TENANT_REGISTRY_URL;
  if (!url) {
    throw new Error("TENANT_REGISTRY_URL is not set");
  }
  return url;
}

async function withRegistryClient<T>(fn: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: getRegistryUrl() });
  await client.connect();
  try {
    await client.query(REGISTRY_TABLE_SQL);
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function listTenants(): Promise<Omit<TenantRegistryRow, "dbPassword">[]> {
  return withRegistryClient(async (client) => {
    const result = await client.query(
      `SELECT id,
              subdomain,
              company_name as "companyName",
              db_name as "dbName",
              db_user as "dbUser",
              db_host as "dbHost",
              db_port as "dbPort",
              created_at as "createdAt"
       FROM tenant_registry
       ORDER BY created_at DESC`
    );
    return result.rows;
  });
}

export async function createTenantRegistryEntry(input: {
  id: string;
  subdomain: string;
  companyName: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbHost: string;
  dbPort?: number;
}) {
  return withRegistryClient(async (client) => {
    const result = await client.query(
      `INSERT INTO tenant_registry (
         id, subdomain, company_name, db_name, db_user, db_password, db_host, db_port
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,
                 subdomain,
                 company_name as "companyName",
                 db_name as "dbName",
                 db_user as "dbUser",
                 db_host as "dbHost",
                 db_port as "dbPort",
                 created_at as "createdAt"`,
      [
        input.id,
        input.subdomain,
        input.companyName,
        input.dbName,
        input.dbUser,
        input.dbPassword,
        input.dbHost,
        input.dbPort ?? 5432
      ]
    );
    return result.rows[0];
  });
}
