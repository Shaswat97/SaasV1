"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-xl border border-transparent px-4 py-3 transition",
              isActive
                ? "bg-accent/20 text-text border-accent/40"
                : "text-text-muted hover:bg-surface/70 hover:text-text"
            )}
          >
            <div className="text-sm font-medium">{item.label}</div>
            <div className="mt-1 text-xs text-text-muted">{item.description}</div>
          </Link>
        );
      })}
    </nav>
  );
}
