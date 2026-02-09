export type NavItem = {
  label: string;
  href: string;
  description: string;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", description: "Executive overview" },
  { label: "Sales Orders", href: "/sales-orders", description: "Order intake & tracking" },
  { label: "Purchasing", href: "/purchasing", description: "Vendor commitments" },
  { label: "Subcontracting", href: "/purchasing/subcontracting", description: "Outsourced production" },
  { label: "Production", href: "/production", description: "Shop-floor execution" },
  { label: "Inventory", href: "/inventory", description: "Stock positions" },
  { label: "Reports", href: "/reports", description: "Financial & ops" },
  { label: "Activity", href: "/activity", description: "Audit trail" },
  { label: "Settings", href: "/settings", description: "Company profile" }
];
