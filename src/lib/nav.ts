import type { LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";

export type NavItem = {
  label: string;
  href: string;
  description: string;
  permission?: string;
  icon: string;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", description: "Executive overview", permission: "dashboard.view", icon: "LayoutDashboard" },
  { label: "Sales Orders", href: "/sales-orders", description: "Order intake & tracking", permission: "sales.view", icon: "ShoppingCart" },
  { label: "Purchasing", href: "/purchasing", description: "Vendor commitments", permission: "purchase.view", icon: "Truck" },
  {
    label: "Subcontracting",
    href: "/purchasing/subcontracting",
    description: "Outsourced production",
    permission: "purchase.view",
    icon: "PackageCheck"
  },
  { label: "Production", href: "/production", description: "Shop-floor execution", permission: "production.view", icon: "Factory" },
  { label: "Inventory", href: "/inventory", description: "Stock positions", permission: "inventory.view", icon: "Warehouse" },
  { label: "Reports", href: "/reports", description: "Financial & ops", permission: "reports.view", icon: "BarChart3" },
  { label: "Documents", href: "/reports/documents", description: "PDF archive", permission: "reports.view", icon: "FileText" },
  { label: "Activity", href: "/activity", description: "Audit trail", permission: "activity.view", icon: "History" },
  { label: "Settings", href: "/settings", description: "Company profile", permission: "settings.view", icon: "Settings" }
];
