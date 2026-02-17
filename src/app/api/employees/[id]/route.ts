import { getTenantPrisma } from "@/lib/tenant-prisma";
import { employeeSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { hashPin } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "users.manage_employees");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const employee = await prisma.employee.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { roles: { include: { role: true } } }
  });

  if (!employee) return jsonError("Employee not found", 404);

  return jsonOk(employee);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "users.manage_employees");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = employeeSchema.partial().safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  if (parsed.data.roles && parsed.data.roles.length === 0) {
    return jsonError("At least one role is required", 400);
  }

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);

  const existing = await prisma.employee.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!existing) return jsonError("Employee not found", 404);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: params.id },
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          pinHash: parsed.data.pin ? hashPin(parsed.data.pin) : undefined,
          pinUpdatedAt: parsed.data.pin ? new Date() : undefined,
          active: parsed.data.active
        }
      });

      if (parsed.data.roles) {
        const roleNames = parsed.data.roles.map((role) => role.trim().toUpperCase());
        const roles = await tx.role.findMany({
          where: {
            companyId,
            name: { in: roleNames },
            deletedAt: null
          }
        });

        if (roles.length !== roleNames.length) {
          throw new Error("ROLE_INVALID");
        }

        await tx.employeeRole.deleteMany({
          where: { employeeId: params.id }
        });

        await tx.employeeRole.createMany({
          data: roles.map((role) => ({ employeeId: params.id, roleId: role.id }))
        });
      }
    });

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: { roles: { include: { role: true } } }
    });

    if (employee) {
      await recordActivity({
        companyId,
        actorName,
        actorEmployeeId,
        action: "UPDATE",
        entityType: "Employee",
        entityId: employee.id,
        summary: `Updated employee ${employee.code} · ${employee.name}.`
      });
    }

    return jsonOk(employee);
  } catch (error: any) {
    if (error?.message === "ROLE_INVALID") {
      return jsonError("One or more roles are invalid", 400);
    }
    if (error?.code === "P2002") {
      return jsonError("Employee code already exists", 409);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const guard = await requirePermission(request, "users.manage_employees");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);
  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);

  const employee = await prisma.employee.findFirst({
    where: { id: params.id, companyId, deletedAt: null }
  });

  if (!employee) return jsonError("Employee not found", 404);

  const updated = await prisma.employee.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "DELETE",
    entityType: "Employee",
    entityId: updated.id,
    summary: `Deleted employee ${updated.code} · ${updated.name}.`
  });

  return jsonOk(updated);
}
