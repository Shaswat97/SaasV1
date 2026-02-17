import { getTenantPrisma } from "@/lib/tenant-prisma";
import { jsonOk } from "@/lib/api-helpers";
import { AUTH_COOKIE, revokeSessionByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function readCookieToken(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${AUTH_COOKIE}=`)) continue;
    return decodeURIComponent(part.slice(AUTH_COOKIE.length + 1));
  }
  return null;
}

export async function POST(request: Request) {
  const prisma = await getTenantPrisma(request);
  if (prisma) {
    const token = readCookieToken(request);
    if (token) {
      await revokeSessionByToken(prisma, token);
    }
  }

  const response = jsonOk({ loggedOut: true });
  response.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
  return response;
}

