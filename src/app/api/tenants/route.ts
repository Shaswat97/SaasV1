import { z } from "zod";
import { randomUUID } from "crypto";
import { jsonError, jsonOk, zodError } from "@/lib/api-helpers";
import { createTenantRegistryEntry, listTenants } from "@/lib/tenant-registry";

const tenantSchema = z.object({
  subdomain: z.string().min(1),
  companyName: z.string().min(1),
  dbName: z.string().min(1),
  dbUser: z.string().min(1),
  dbPassword: z.string().min(1),
  dbHost: z.string().min(1),
  dbPort: z.number().int().positive().optional()
});

export async function GET() {
  const tenants = await listTenants();
  return jsonOk(tenants);
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON payload");
  }

  const parsed = tenantSchema.safeParse(payload);
  if (!parsed.success) return zodError(parsed.error);

  const entry = await createTenantRegistryEntry({
    id: randomUUID(),
    ...parsed.data
  });
  return jsonOk(entry, { status: 201 });
}
