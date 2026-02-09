import { prisma } from "@/lib/prisma";
import { employeeSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const companyId = await getDefaultCompanyId();
  const employee = await prisma.employee.findFirst({
    where: { id: params.id, companyId, deletedAt: null },
    include: { roles: { include: { role: true } } }
  });

  if (!employee) return jsonError("Employee not found", 404);

  return jsonOk(employee);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
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

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

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
          active: parsed.data.active
        }
      });

      if (parsed.data.roles) {
        const roles = await tx.role.findMany({
          where: {
            companyId,
            name: { in: parsed.data.roles },
            deletedAt: null
          }
        });

        if (roles.length !== parsed.data.roles.length) {
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
  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

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
