export type PermissionDefinition = {
  key: string;
  label: string;
  group: string;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: "dashboard.view", label: "View dashboard", group: "General" },
  { key: "reports.view", label: "View reports", group: "General" },
  { key: "activity.view", label: "View activity log", group: "General" },

  { key: "sales.view", label: "View sales orders", group: "Sales" },
  { key: "sales.create", label: "Create / edit sales orders", group: "Sales" },
  { key: "sales.confirm", label: "Confirm sales orders", group: "Sales" },
  { key: "sales.procure", label: "Raise draft PO from sales orders", group: "Sales" },
  { key: "sales.production", label: "Move sales order to production", group: "Sales" },
  { key: "sales.dispatch", label: "Move sales order to dispatch", group: "Sales" },
  { key: "sales.deliver", label: "Mark sales order delivered", group: "Sales" },
  { key: "sales.invoice.create", label: "Create sales invoices", group: "Sales" },
  { key: "sales.payment.record", label: "Record customer payments", group: "Sales" },

  { key: "purchase.view", label: "View purchasing", group: "Purchase" },
  { key: "purchase.create", label: "Create / edit purchase orders", group: "Purchase" },
  { key: "purchase.confirm", label: "Confirm purchase orders", group: "Purchase" },
  { key: "purchase.approve", label: "Approve purchase orders", group: "Purchase" },
  { key: "purchase.receive", label: "Receive against purchase orders", group: "Purchase" },
  { key: "vendor.bill.record", label: "Record vendor bills", group: "Purchase" },
  { key: "vendor.payment.record", label: "Record vendor payments", group: "Purchase" },

  { key: "production.view", label: "View production", group: "Production" },
  { key: "production.start", label: "Start production logs", group: "Production" },
  { key: "production.close", label: "Close production logs", group: "Production" },

  { key: "inventory.view", label: "View inventory", group: "Inventory" },
  { key: "inventory.adjust", label: "Post inventory adjustments", group: "Inventory" },
  { key: "inventory.transfer", label: "Post stock transfers", group: "Inventory" },
  { key: "inventory.cycle_count", label: "Run cycle count", group: "Inventory" },

  { key: "settings.view", label: "View settings", group: "Settings" },
  { key: "settings.master_data", label: "Edit master data", group: "Settings" },
  { key: "settings.import", label: "Use import tools", group: "Settings" },
  { key: "settings.reset_data", label: "Reset tenant data", group: "Settings" },

  { key: "users.manage_roles", label: "Manage roles & permissions", group: "Users" },
  { key: "users.manage_employees", label: "Manage employees", group: "Users" }
];

export const ALL_PERMISSION_KEYS = PERMISSION_DEFINITIONS.map((permission) => permission.key);

const SALES_BASE = [
  "dashboard.view",
  "reports.view",
  "activity.view",
  "sales.view",
  "sales.create",
  "sales.confirm",
  "sales.procure",
  "sales.production",
  "sales.dispatch",
  "sales.deliver",
  "sales.invoice.create",
  "sales.payment.record"
];

const PURCHASE_BASE = [
  "dashboard.view",
  "reports.view",
  "activity.view",
  "purchase.view",
  "purchase.create",
  "purchase.confirm",
  "purchase.approve",
  "purchase.receive",
  "vendor.bill.record",
  "vendor.payment.record",
  "inventory.view"
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [...ALL_PERMISSION_KEYS],
  PROCUREMENT_MANAGER: PURCHASE_BASE,
  ORDER_MANAGER: SALES_BASE,
  ACCOUNTANT: [
    "dashboard.view",
    "reports.view",
    "activity.view",
    "sales.view",
    "sales.invoice.create",
    "sales.payment.record",
    "purchase.view",
    "vendor.bill.record",
    "vendor.payment.record",
    "inventory.view"
  ],
  NORMAL: [
    "dashboard.view",
    "reports.view",
    "activity.view",
    "sales.view",
    "purchase.view",
    "production.view",
    "inventory.view",
    "settings.view"
  ]
};

export const DEFAULT_ROLE_NAMES = Object.keys(DEFAULT_ROLE_PERMISSIONS);

export function normalizePermissions(input: string[]) {
  const valid = new Set(ALL_PERMISSION_KEYS);
  return [...new Set(input)].filter((permission) => valid.has(permission)).sort();
}

