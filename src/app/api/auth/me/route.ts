import { jsonError, jsonOk } from "@/lib/api-helpers";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { resolveAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const prisma = await getTenantPrisma(request);
  if (!prisma) return jsonError("Tenant not found", 404);

  const auth = await resolveAuthContext(request, prisma);
  if (!auth) return jsonError("Authentication required", 401);

  return jsonOk(auth);
}

