import type { Prisma, PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import { buildTenantDatabaseUrl, getTenantBySubdomain } from "@/lib/tenant-registry";

export type ResolvedTenant = {
  slug: string;
  host: string;
  databaseUrl: string;
  source: "default" | "registry";
  companyName?: string;
};

const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "technosynergians.com";

function normalizeHost(host: string | null) {
  if (!host) return null;
  return host.split(":")[0].trim().toLowerCase();
}

function isIpAddress(hostname: string) {
  if (hostname.includes(":")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function parseHost(hostname: string) {
  const base = BASE_DOMAIN.toLowerCase();
  const isLocalhost =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "::1";
  const isBaseDomain = hostname === base || hostname === `www.${base}`;
  const isIp = isIpAddress(hostname);

  if (isBaseDomain || isIp) {
    return { slug: null, isLocalhost, isBaseDomain: true };
  }

  if (hostname.endsWith(`.${base}`)) {
    const slug = hostname.slice(0, -(base.length + 1));
    return { slug, isLocalhost, isBaseDomain: false };
  }

  if (isLocalhost) {
    const parts = hostname.split(".");
    const slug = parts.length > 1 ? parts[0] : null;
    return { slug, isLocalhost: true, isBaseDomain: false };
  }

  const fallbackSlug = hostname.split(".")[0];
  return { slug: fallbackSlug || null, isLocalhost: false, isBaseDomain: false };
}

function getDefaultTenant(host: string): ResolvedTenant {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set for default tenant.");
  }
  return {
    slug: "default",
    host,
    databaseUrl,
    source: "default"
  };
}

export async function resolveTenant(request?: Request): Promise<ResolvedTenant | null> {
  let host = request?.headers.get("host") ?? null;
  if (!host) {
    try {
      host = headers().get("host");
    } catch {
      host = null;
    }
  }

  const hostname = normalizeHost(host);
  if (!hostname) return getDefaultTenant("unknown");

  const { slug, isLocalhost, isBaseDomain } = parseHost(hostname);

  if (!slug || slug === "www") {
    return getDefaultTenant(hostname);
  }

  const registryRow = await getTenantBySubdomain(slug);
  if (registryRow) {
    return {
      slug,
      host: hostname,
      databaseUrl: buildTenantDatabaseUrl(registryRow),
      source: "registry",
      companyName: registryRow.companyName
    };
  }

  if (isLocalhost) {
    return getDefaultTenant(hostname);
  }

  if (isBaseDomain) {
    return getDefaultTenant(hostname);
  }

  return null;
}

export async function getDefaultCompanyId(db: PrismaClient | Prisma.TransactionClient) {
  const company = await db.company.findFirst({
    where: { deletedAt: null },
    select: { id: true }
  });

  if (!company) {
    throw new Error("No company found. Seed the database first.");
  }

  return company.id;
}
