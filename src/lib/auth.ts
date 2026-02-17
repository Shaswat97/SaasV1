import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { getDefaultCompanyId } from "@/lib/tenant";

const PIN_HASH_PREFIX = "scrypt";
const PIN_HASH_LENGTH = 64;
const SESSION_TTL_HOURS = 24 * 14;

export const AUTH_COOKIE = "ts_session";

export type AuthContext = {
  companyId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  roleNames: string[];
  permissions: string[];
  isAdmin: boolean;
};

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveAuthContextFromToken(
  prisma: PrismaClient | Prisma.TransactionClient,
  token: string
): Promise<AuthContext | null> {
  const session = await prisma.appSession.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: {
      employee: {
        include: {
          roles: {
            include: { role: true }
          }
        }
      }
    }
  });

  if (!session || session.employee.deletedAt || !session.employee.active) {
    return null;
  }

  await prisma.appSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  const roleNames = session.employee.roles.map((entry) => entry.role.name);
  const permissions = [...new Set(session.employee.roles.flatMap((entry) => entry.role.permissions))];

  return {
    companyId: session.companyId,
    employeeId: session.employeeId,
    employeeCode: session.employee.code,
    employeeName: session.employee.name,
    roleNames,
    permissions,
    isAdmin: roleNames.includes("ADMIN")
  };
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(pin, salt, PIN_HASH_LENGTH).toString("hex");
  return `${PIN_HASH_PREFIX}$${salt}$${digest}`;
}

export function verifyPin(pin: string, encodedHash: string | null | undefined) {
  if (!encodedHash) return false;
  const [algo, salt, digest] = encodedHash.split("$");
  if (algo !== PIN_HASH_PREFIX || !salt || !digest) return false;
  const candidate = scryptSync(pin, salt, PIN_HASH_LENGTH);
  const target = Buffer.from(digest, "hex");
  if (candidate.length !== target.length) return false;
  return timingSafeEqual(candidate, target);
}

export async function createSession(
  prisma: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  employeeId: string
) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.appSession.create({
    data: {
      companyId,
      employeeId,
      tokenHash,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export async function revokeSessionByToken(
  prisma: PrismaClient | Prisma.TransactionClient,
  token: string
) {
  await prisma.appSession.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeAllEmployeeSessions(
  prisma: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  employeeId: string
) {
  await prisma.appSession.updateMany({
    where: { companyId, employeeId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function resolveAuthContext(
  request: Request,
  prisma?: PrismaClient | Prisma.TransactionClient
): Promise<AuthContext | null> {
  const db = prisma ?? (await getTenantPrisma(request));
  if (!db) return null;

  const cookieHeader = request.headers.get("cookie");
  const token = parseCookieHeader(cookieHeader)[AUTH_COOKIE];
  if (!token) return null;
  return resolveAuthContextFromToken(db, token);
}

export async function resolveAuthContextByCookieValue(
  token: string | null | undefined,
  prisma: PrismaClient | Prisma.TransactionClient
) {
  if (!token) return null;
  return resolveAuthContextFromToken(prisma, token);
}

export async function requireAuthContext(
  request: Request,
  prisma?: PrismaClient | Prisma.TransactionClient
) {
  const db = prisma ?? (await getTenantPrisma(request));
  if (!db) {
    throw new Error("Tenant not found");
  }
  const auth = await resolveAuthContext(request, db);
  if (!auth) {
    return null;
  }
  return { auth, prisma: db };
}

export async function getFallbackAdminAuth(
  prisma: PrismaClient | Prisma.TransactionClient
): Promise<AuthContext | null> {
  const companyId = await getDefaultCompanyId(prisma);
  const admin = await prisma.employee.findFirst({
    where: { companyId, deletedAt: null, active: true, roles: { some: { role: { name: "ADMIN" } } } },
    include: { roles: { include: { role: true } } },
    orderBy: { createdAt: "asc" }
  });
  if (!admin) return null;

  return {
    companyId,
    employeeId: admin.id,
    employeeCode: admin.code,
    employeeName: admin.name,
    roleNames: admin.roles.map((entry) => entry.role.name),
    permissions: [...new Set(admin.roles.flatMap((entry) => entry.role.permissions))],
    isAdmin: true
  };
}

export function hasPermission(auth: AuthContext | null, permission: string) {
  if (!auth) return false;
  if (auth.isAdmin) return true;
  return auth.permissions.includes(permission);
}

export function hasAnyPermission(auth: AuthContext | null, permissions: string[]) {
  return permissions.some((permission) => hasPermission(auth, permission));
}

export type AppDb = PrismaClient | Prisma.TransactionClient;
