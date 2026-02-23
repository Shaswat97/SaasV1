import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/SidebarNav";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DarkModeToggle } from "@/components/DarkModeToggle";
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
      <div className="min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-50 flex w-20 flex-col bg-sidebar text-sidebar-fg transition-all duration-300 ease-in-out hover:w-72 group overflow-hidden">
          <div className="flex flex-col gap-6 p-4 h-full">
            <div>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                    <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm14.25 6a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L15.44 12l-1.72-1.72a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm-10.28 0a.75.75 0 01.22-.53l2.25-2.25a.75.75 0 111.06 1.06L8.56 12l1.72 1.72a.75.75 0 11-1.06 1.06l-2.25-2.25a.75.75 0 01-.22-.53z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto transition-all duration-300 whitespace-nowrap overflow-hidden">
                  <h2 className="text-lg font-bold tracking-tight text-white">Techno Synergians</h2>
                  <p className="text-xs text-sidebar-muted">Manufacturing OS</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin">
              <SidebarNav permissions={auth.permissions} isAdmin={auth.isAdmin} />
            </div>

            <div className="mt-auto space-y-4">
              <div className="group/profile overflow-hidden whitespace-nowrap rounded-2xl bg-white/5 p-2 text-xs text-sidebar-muted transition-all duration-300 hover:bg-white/10 hover:text-sidebar-fg group-hover:p-3">
                <p className="hidden font-medium uppercase tracking-wider text-sidebar-muted/80 group-hover:block">
                  Signed In
                </p>
                <div className="mt-0 flex items-center justify-center gap-3 group-hover:mt-2 group-hover:justify-start">
                  <div className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-full bg-accent/20 text-accent font-bold">
                    {auth.employeeName.charAt(0)}
                  </div>
                  <div className="hidden group-hover:block whitespace-normal">
                    <p className="text-sm font-semibold text-sidebar-fg line-clamp-1">{auth.employeeName}</p>
                    <p className="text-[10px] uppercase tracking-wide opacity-80">{auth.roleNames[0]}</p>
                  </div>
                </div>
                <div className="hidden mt-3 border-t border-white/10 pt-3 group-hover:flex items-center justify-between">
                  <LogoutButton />
                  <DarkModeToggle />
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main className="min-h-screen bg-surface ml-20">
          <div className="container mx-auto p-4 md:p-8 lg:p-12 max-w-[1920px]">
            {children}
          </div>
        </main>
      </div >
    </div >
  );
}
