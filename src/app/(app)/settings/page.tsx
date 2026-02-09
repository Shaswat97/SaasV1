import Link from "next/link";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { SampleDataCard } from "@/components/SampleDataCard";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Settings"
        subtitle="Company configuration, master data, and permissions for RAG Industries."
        actions={<Button variant="secondary">Invite User</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4 text-sm text-text-muted">
              <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em]">Base Currency</p>
                <p className="mt-2">INR (₹) — single-tenant configuration</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em]">Fiscal Calendar</p>
                <p className="mt-2">April to March (FY2026)</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card variant="strong">
          <CardHeader>
            <CardTitle>Master Data</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4 text-sm text-text-muted">
              <p>Item masters, routing, work centers, and BOM libraries live here.</p>
              <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em]">Status</p>
                <p className="mt-2">12 item families · 3 plants · 8 work centers</p>
              </div>
              <Link href="/settings/master-data">
                <Button className="w-full" variant="primary">
                  Manage Master Data
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card variant="strong">
        <CardHeader>
          <CardTitle>Master Data</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
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
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm transition hover:border-accent/60"
              >
                <p className="text-base font-semibold text-text">{item.label}</p>
                <p className="mt-2 text-xs text-text-muted">{item.description}</p>
              </Link>
            ))}
            <Link
              href="/settings/import"
              className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm transition hover:border-accent/60"
            >
              <p className="text-base font-semibold text-text">CSV Import Center</p>
              <p className="mt-2 text-xs text-text-muted">Upload system templates to onboard master data.</p>
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Contact</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-3">
            <Input label="Contact Name" placeholder="Riya Sharma" />
            <Input label="Email Address" type="email" placeholder="riya@ragindustries.in" />
            <Input label="Phone" placeholder="+91 98 0000 0000" />
          </div>
        </CardBody>
      </Card>

      <SampleDataCard />
    </div>
  );
}
