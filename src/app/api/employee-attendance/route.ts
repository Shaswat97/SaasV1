import { z } from "zod";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";
import { getActorFromRequest, recordActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const attendanceUpsertSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Attendance date must be YYYY-MM-DD"),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"]),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  notes: z.string().max(500).optional().nullable()
});

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildDateTimeForDay(date: Date, time?: string | null) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0, 0)
  );
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "users.manage_employees");
  if (guard.error) return guard.error;
  const prisma = guard.prisma;
  if (!prisma) return jsonError("Tenant not found", 404);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const employeeId = searchParams.get("employeeId");

  let dateFilter:
    | { attendanceDate: { gte?: Date; lte?: Date } }
    | { attendanceDate: Date }
    | undefined;

  if (dateParam) {
    const date = parseDateOnly(dateParam);
    if (!date) return jsonError("Invalid date");
    dateFilter = { attendanceDate: date };
  } else if (fromParam || toParam) {
    const from = fromParam ? parseDateOnly(fromParam) : null;
    const to = toParam ? parseDateOnly(toParam) : null;
    if ((fromParam && !from) || (toParam && !to)) return jsonError("Invalid date range");
    if (from && to && from > to) return jsonError("From date cannot be after to date");
    dateFilter = {
      attendanceDate: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {})
      }
    };
  }

  const records = await prisma.employeeAttendance.findMany({
    where: {
      companyId,
      ...(employeeId ? { employeeId } : {}),
      ...(dateFilter ?? {})
    },
    include: {
      employee: {
        select: {
          id: true,
          code: true,
          name: true,
          active: true
        }
      }
    },
    orderBy: [{ attendanceDate: "desc" }, { employee: { name: "asc" } }]
  });

  return jsonOk(
    records.map((record) => ({
      ...record,
      attendanceDate: record.attendanceDate.toISOString().slice(0, 10),
      checkInTime: record.checkInAt ? record.checkInAt.toISOString().slice(11, 16) : null,
      checkOutTime: record.checkOutAt ? record.checkOutAt.toISOString().slice(11, 16) : null
    }))
  );
}

export async function POST(request: Request) {
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

  const parsed = attendanceUpsertSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const companyId = guard.context?.companyId ?? (await getDefaultCompanyId(prisma));
  const { actorName, actorEmployeeId } = guard.context
    ? { actorName: guard.context.actorName, actorEmployeeId: guard.context.actorEmployeeId }
    : getActorFromRequest(request);

  const attendanceDate = parseDateOnly(parsed.data.attendanceDate);
  if (!attendanceDate) return jsonError("Invalid attendance date");

  const employee = await prisma.employee.findFirst({
    where: {
      id: parsed.data.employeeId,
      companyId,
      deletedAt: null
    },
    select: { id: true, code: true, name: true }
  });

  if (!employee) return jsonError("Employee not found", 404);

  const checkInAt = buildDateTimeForDay(attendanceDate, parsed.data.checkInTime ?? null);
  const checkOutAt = buildDateTimeForDay(attendanceDate, parsed.data.checkOutTime ?? null);
  if (checkInAt && checkOutAt && checkOutAt < checkInAt) {
    return jsonError("Check-out time cannot be earlier than check-in time", 400);
  }

  const saved = await prisma.employeeAttendance.upsert({
    where: {
      companyId_employeeId_attendanceDate: {
        companyId,
        employeeId: employee.id,
        attendanceDate
      }
    },
    update: {
      status: parsed.data.status,
      checkInAt,
      checkOutAt,
      notes: parsed.data.notes?.trim() || null
    },
    create: {
      companyId,
      employeeId: employee.id,
      attendanceDate,
      status: parsed.data.status,
      checkInAt,
      checkOutAt,
      notes: parsed.data.notes?.trim() || null
    },
    include: {
      employee: {
        select: { id: true, code: true, name: true, active: true }
      }
    }
  });

  await recordActivity({
    companyId,
    actorName,
    actorEmployeeId,
    action: "UPDATE",
    entityType: "EmployeeAttendance",
    entityId: saved.id,
    summary: `Attendance ${saved.status} marked for ${employee.code} · ${employee.name} on ${parsed.data.attendanceDate}.`
  });

  return jsonOk({
    ...saved,
    attendanceDate: saved.attendanceDate.toISOString().slice(0, 10),
    checkInTime: saved.checkInAt ? saved.checkInAt.toISOString().slice(11, 16) : null,
    checkOutTime: saved.checkOutAt ? saved.checkOutAt.toISOString().slice(11, 16) : null
  });
}
