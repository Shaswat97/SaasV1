import type { ReactNode } from "react";
import { SidebarNav } from "@/components/SidebarNav";
import { ActiveUserSelect } from "@/components/ActiveUserSelect";

export default function AppLayout({ children }: { children: ReactNode }) {
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
          <SidebarNav />
          <div className="mt-auto space-y-4">
            <ActiveUserSelect />
            <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-xs text-text-muted">
              <p className="uppercase tracking-[0.2em]">Roles</p>
              <p className="mt-2">Owner · Production Manager · Accountant</p>
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
