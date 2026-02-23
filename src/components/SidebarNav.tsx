"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  PackageCheck,
  Factory,
  Warehouse,
  BarChart3,
  FileText,
  History,
  Settings,
  type LucideIcon
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  PackageCheck,
  Factory,
  Warehouse,
  BarChart3,
  FileText,
  History,
  Settings
};

type SidebarNavProps = {
  permissions: string[];
  isAdmin: boolean;
};

export function SidebarNav({ permissions, isAdmin }: SidebarNavProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (!item.permission) return true;
    if (isAdmin) return true;
    return permissions.includes(item.permission);
  });

  return (
    <nav className="flex flex-col gap-2">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = iconMap[item.icon] || LayoutDashboard;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group/nav flex h-14 items-center justify-center rounded-2xl px-0 py-2 transition-all duration-200 overflow-hidden whitespace-nowrap",
              "hover:justify-center hover:px-0",
              "group-hover:justify-start group-hover:px-3 group-hover:gap-3",
              isActive
                ? "text-white"
                : "text-sidebar-muted hover:bg-white/5 hover:text-white"
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 min-w-[44px] items-center justify-center rounded-2xl transition-all duration-200",
                isActive
                  ? "bg-accent text-white shadow-lg shadow-accent/30"
                  : "bg-transparent text-inherit group-hover:bg-white/8"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
            </span>
            <div className="flex flex-col opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto transition-all duration-300">
              <div className="text-sm font-semibold">{item.label}</div>
              {/* Description might be too much for the hover menu, maybe hide it or keep it subtle? User asked for icons and expand. Let's keep label distinct. */}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
