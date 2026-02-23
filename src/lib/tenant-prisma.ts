import { PrismaClient } from "@prisma/client";
import { resolveTenant, type ResolvedTenant } from "@/lib/tenant";

type PrismaCache = Map<string, PrismaClient>;

const globalForTenant = globalThis as unknown as { tenantPrisma?: PrismaCache };
const cache = globalForTenant.tenantPrisma ?? new Map<string, PrismaClient>();

if (process.env.NODE_ENV !== "production") {
  globalForTenant.tenantPrisma = cache;
}

function getCachedClient(tenant: ResolvedTenant) {
  const url = tenant.databaseUrl;
  let client = cache.get(url);
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url } },
      log: ["error", "warn"]
    });
    cache.set(url, client);
  }
  return client;
}

export async function getTenantPrisma(request?: Request): Promise<PrismaClient | null> {
  const tenant = await resolveTenant(request);
  if (!tenant) return null;
  return getCachedClient(tenant);
}

export async function getTenantInfo(request?: Request): Promise<ResolvedTenant | null> {
  return resolveTenant(request);
}
