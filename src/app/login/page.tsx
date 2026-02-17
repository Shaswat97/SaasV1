import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { LoginForm } from "@/components/LoginForm";
import { AUTH_COOKIE, resolveAuthContextByCookieValue } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const prisma = await getTenantPrisma();
  if (!prisma) {
    return <div className="p-8 text-danger">Tenant not found.</div>;
  }

  const token = cookies().get(AUTH_COOKIE)?.value ?? null;
  const auth = await resolveAuthContextByCookieValue(token, prisma);
  if (auth) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Techno Synergians</p>
          <CardTitle className="mt-3">Sign In</CardTitle>
        </CardHeader>
        <CardBody>
          <LoginForm />
          <p className="mt-4 text-xs text-text-muted">Use employee code and PIN assigned by Admin.</p>
        </CardBody>
      </Card>
    </div>
  );
}

