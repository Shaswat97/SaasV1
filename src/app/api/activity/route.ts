import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-helpers";
import { getDefaultCompanyId } from "@/lib/tenant";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const entityType = searchParams.get("entity");
  const action = searchParams.get("action");
  const actor = searchParams.get("actor");
  const search = searchParams.get("search");
  const limit = Number(searchParams.get("limit") ?? "200");

  const companyId = await getDefaultCompanyId();

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00`);
  if (to) createdAt.lte = new Date(`${to}T23:59:59.999`);

  const logs = await prisma.activityLog.findMany({
    where: {
      companyId,
      ...(entityType && entityType !== "ALL" ? { entityType } : {}),
      ...(action && action !== "ALL" ? { action } : {}),
      ...(actor && actor !== "ALL" ? { actorName: actor } : {}),
      ...(from || to ? { createdAt } : {}),
      ...(search
        ? {
            OR: [
              { summary: { contains: search } },
              { entityId: { contains: search } },
              { actorName: { contains: search } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200
  });

  return jsonOk(logs);
}
