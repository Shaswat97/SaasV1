import { prisma } from "@/lib/prisma";
import { employeeSchema } from "@/lib/validation";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const companyId = await getDefaultCompanyId();

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      ...(includeDeleted ? {} : { deletedAt: null })
    },
    include: {
      roles: {
        include: { role: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return jsonOk(employees);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = employeeSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = await getDefaultCompanyId();
  const { actorName, actorEmployeeId } = getActorFromRequest(request);

  const roles = await prisma.role.findMany({
    where: {
      companyId,
      name: { in: parsed.data.roles },
      deletedAt: null
    }
  });

  if (roles.length !== parsed.data.roles.length) {
    return jsonError("One or more roles are invalid", 400);
  }

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          companyId,
          code: parsed.data.code,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          active: parsed.data.active ?? true
        }
      });

      await tx.employeeRole.createMany({
        data: roles.map((role) => ({ employeeId: created.id, roleId: role.id }))
      });

      return created;
    });

    const result = await prisma.employee.findUnique({
      where: { id: employee.id },
      include: { roles: { include: { role: true } } }
    });

    await recordActivity({
      companyId,
      actorName,
      actorEmployeeId,
      action: "CREATE",
      entityType: "Employee",
      entityId: employee.id,
      summary: `Created employee ${result?.code ?? employee.code} · ${result?.name ?? employee.name}.`
    });

    return jsonOk(result, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError("Employee code already exists", 409);
    }
    throw error;
  }
}
