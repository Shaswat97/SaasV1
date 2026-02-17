import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/SidebarNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";
import { AUTH_COOKIE, resolveAuthContextByCookieValue } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const prisma = await getTenantPrisma();
  if (!prisma) {
    redirect("/login");
  }

  const token = cookies().get(AUTH_COOKIE)?.value ?? null;
  const auth = await resolveAuthContextByCookieValue(token, prisma);
  if (!auth) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="panel-strong m-4 flex flex-col gap-6 overflow-y-auto p-6 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Techno Synergians</p>
            <h2 className="mt-3 text-2xl font-semibold">Manufacturing Ops</h2>
            <p className="mt-2 text-sm text-text-muted">
              Single-tenant operating system for planning, execution, and financial control.
            </p>
          </div>
          <SidebarNav permissions={auth.permissions} isAdmin={auth.isAdmin} />
          <div className="mt-auto space-y-4">
            <ThemeToggle />
            <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-xs text-text-muted">
              <p className="uppercase tracking-[0.2em]">Signed In</p>
              <p className="mt-2 text-sm text-text">{auth.employeeCode} · {auth.employeeName}</p>
              <p className="mt-1">{auth.roleNames.join(", ")}</p>
              <p className="mt-1">Permissions: {auth.permissions.length}</p>
              <div className="mt-3">
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>
        <div className="px-4 pb-10 pt-8 lg:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
