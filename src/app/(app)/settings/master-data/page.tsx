import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { SectionHeader } from "@/components/SectionHeader";

const masterItems = [
  { label: "Company", href: "/settings/master-data/company", description: "Identity & tax details" },
  { label: "Vendors", href: "/settings/master-data/vendors", description: "Raw suppliers" },
  { label: "Customers", href: "/settings/master-data/customers", description: "Sales accounts" },
  { label: "Employees", href: "/settings/master-data/employees", description: "Directory & access" },
  { label: "Roles", href: "/settings/master-data/roles", description: "Admin role settings" },
  { label: "Warehouses", href: "/settings/master-data/warehouses", description: "Storage sites" },
  { label: "Zones", href: "/settings/master-data/zones", description: "Operational zones" },
  { label: "Machines & Machine SKUs", href: "/settings/master-data/machines-routing", description: "Assets, capacity & routing rates" },
  { label: "Raw SKUs", href: "/settings/master-data/raw-skus", description: "Inputs & scrap" },
  { label: "BOMs", href: "/settings/master-data/boms", description: "Materials mapping" },
  { label: "Finished SKUs", href: "/settings/master-data/finished-skus", description: "Products & BOMs" }
];

export default function MasterDataIndexPage() {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Master Data"
        subtitle="Single source of truth for manufacturing entities used across the platform."
      />

      <Card>
        <CardHeader>
          <CardTitle>Manage Masters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-3">
            {masterItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm transition hover:border-accent/60"
              >
                <p className="text-base font-semibold text-text">{item.label}</p>
                <p className="mt-2 text-xs text-text-muted">{item.description}</p>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
