import { jsonOk } from "@/lib/api-helpers";
import { getAdminContext } from "@/lib/permissions";

export async function GET(request: Request) {
  const { actorName, actorEmployeeId, isAdmin } = await getAdminContext(request);

  return jsonOk({
    actorName,
    actorEmployeeId,
    isAdmin
  });
}
