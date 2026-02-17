export type NavItem = {
  label: string;
  href: string;
  description: string;
  permission?: string;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", description: "Executive overview", permission: "dashboard.view" },
  { label: "Sales Orders", href: "/sales-orders", description: "Order intake & tracking", permission: "sales.view" },
  { label: "Purchasing", href: "/purchasing", description: "Vendor commitments", permission: "purchase.view" },
  {
    label: "Subcontracting",
    href: "/purchasing/subcontracting",
    description: "Outsourced production",
    permission: "purchase.view"
  },
  { label: "Production", href: "/production", description: "Shop-floor execution", permission: "production.view" },
  { label: "Inventory", href: "/inventory", description: "Stock positions", permission: "inventory.view" },
  { label: "Reports", href: "/reports", description: "Financial & ops", permission: "reports.view" },
  { label: "Documents", href: "/reports/documents", description: "PDF archive", permission: "reports.view" },
  { label: "Activity", href: "/activity", description: "Audit trail", permission: "activity.view" },
  { label: "Settings", href: "/settings", description: "Company profile", permission: "settings.view" }
];
