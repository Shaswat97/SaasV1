import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  Boxes,
  Building2,
  Calculator,
  Factory,
  FileSpreadsheet,
  MapPinned,
  Package,
  Tags,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
  Warehouse
} from "lucide-react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { Input } from "@/components/Input";
import { ProcessFlowButton } from "@/components/settings/ProcessFlowButton";
import { SectionHeader } from "@/components/SectionHeader";
import { SampleDataCard } from "@/components/SampleDataCard";
import { cookies } from "next/headers";
import { AUTH_COOKIE, resolveAuthContextByCookieValue } from "@/lib/auth";
import { getTenantPrisma } from "@/lib/tenant-prisma";

type MasterTile = {
  label: string;
  href: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

const masterTiles: MasterTile[] = [
  {
    label: "Company",
    href: "/settings/master-data/company",
    description: "Identity, tax details, print settings, and finance labels.",
    category: "Foundation",
    icon: Building2,
    accent: "from-blue-500/20 to-cyan-500/10"
  },
  {
    label: "Vendors",
    href: "/settings/master-data/vendors",
    description: "Raw suppliers, subcontract vendors, and scrap buyers.",
    category: "Partners",
    icon: Truck,
    accent: "from-emerald-500/20 to-green-500/10"
  },
  {
    label: "Customers",
    href: "/settings/master-data/customers",
    description: "Sales accounts, credit terms, reminders, and contacts.",
    category: "Partners",
    icon: Users,
    accent: "from-orange-500/20 to-amber-500/10"
  },
  {
    label: "Employees",
    href: "/settings/master-data/employees",
    description: "Directory, login access, profiles, and role assignment.",
    category: "Access",
    icon: ShieldCheck,
    accent: "from-purple-500/20 to-indigo-500/10"
  },
  {
    label: "Roles",
    href: "/settings/master-data/roles",
    description: "Permission templates and operational access control.",
    category: "Access",
    icon: Settings2,
    accent: "from-fuchsia-500/20 to-violet-500/10"
  },
  {
    label: "Warehouses",
    href: "/settings/master-data/warehouses",
    description: "Storage sites used for receiving, stocking, and dispatch.",
    category: "Operations",
    icon: Warehouse,
    accent: "from-slate-500/20 to-zinc-500/10"
  },
  {
    label: "Zones",
    href: "/settings/master-data/zones",
    description: "Raw, WIP, Finished, Scrap, and transit operational zones.",
    category: "Operations",
    icon: MapPinned,
    accent: "from-rose-500/20 to-pink-500/10"
  },
  {
    label: "Machines & Machine SKUs",
    href: "/settings/master-data/machines-routing",
    description: "Assets, capacities, routing steps, and machine mappings.",
    category: "Production",
    icon: Factory,
    accent: "from-indigo-500/20 to-blue-500/10"
  },
  {
    label: "Raw SKUs",
    href: "/settings/master-data/raw-skus",
    description: "Raw materials, scrap %, thresholds, and costing defaults.",
    category: "Items",
    icon: Boxes,
    accent: "from-teal-500/20 to-cyan-500/10"
  },
  {
    label: "BOMs",
    href: "/settings/master-data/boms",
    description: "Material mapping for production and consumption tracking.",
    category: "Production",
    icon: Calculator,
    accent: "from-red-500/20 to-orange-500/10"
  },
  {
    label: "Finished SKUs",
    href: "/settings/master-data/finished-skus",
    description: "Products, pricing, thresholds, and finished item setup.",
    category: "Items",
    icon: Package,
    accent: "from-sky-500/20 to-indigo-500/10"
  },
  {
    label: "Sales Price Lists",
    href: "/settings/master-data/sales-pricing",
    description: "Customer-wise sales pricing with date-based validity.",
    category: "Commercial",
    icon: Tags,
    accent: "from-violet-500/20 to-fuchsia-500/10"
  },
  {
    label: "CSV Import Center",
    href: "/settings/import",
    description: "Bulk upload templates for faster master-data onboarding.",
    category: "Tools",
    icon: FileSpreadsheet,
    accent: "from-lime-500/20 to-green-500/10"
  }
];

function OverviewStat({
  label,
  value,
  note,
  icon
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const Icon = icon;
  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-bg-subtle text-text">
          <Icon className="h-4 w-4" />
        </span>
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-text">{value}</p>
      <p className="mt-2 text-xs text-text-muted">{note}</p>
    </div>
  );
}

export default async function SettingsPage() {
  const prisma = await getTenantPrisma();
  const token = cookies().get(AUTH_COOKIE)?.value ?? null;
  const auth = await resolveAuthContextByCookieValue(token, prisma!);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Settings"
        subtitle="Company configuration, master data, and permissions for Techno Synergians."
        actions={<ProcessFlowButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewStat
          label="Base Currency"
          value="INR (₹)"
          note="Single-tenant finance configuration"
          icon={BadgeIndianRupee}
        />
        <OverviewStat
          label="Fiscal Calendar"
          value="Apr → Mar"
          note="Financial year tracking and reporting cycle"
          icon={Calculator}
        />
        <OverviewStat
          label="Master Modules"
          value="12"
          note="Setup areas available for onboarding"
          icon={Settings2}
        />
        <OverviewStat
          label="Operational Setup"
          value="Process Guided"
          note="Use Process Flow to complete mappings in the right order"
          icon={Factory}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1.25fr]">
        <Card className="overflow-hidden border-border/60">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.10),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_45%)]" />
            <CardHeader className="relative">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle>Company Profile</CardTitle>
                  <p className="mt-1 text-sm text-text-muted">Core business identity and finance defaults.</p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="relative">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-text-muted">Base Currency</p>
                  <p className="mt-2 text-base font-medium text-text">INR (₹)</p>
                  <p className="mt-1 text-xs text-text-muted">Used for pricing, billing, payables, and reporting.</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-text-muted">Fiscal Calendar</p>
                  <p className="mt-2 text-base font-medium text-text">April to March (FY2026)</p>
                  <p className="mt-1 text-xs text-text-muted">Aligned for Indian business financial reporting cycles.</p>
                </div>
                <Link href="/settings/master-data/company" className="inline-flex">
                  <Button variant="secondary" className="gap-2">
                    Edit Company Settings
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardBody>
          </div>
        </Card>

        <Card variant="strong" className="overflow-hidden border-border/60">
          <div className="relative">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.10),rgba(37,99,235,0.06))]" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20">
                    <Boxes className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle>Master Data Control Center</CardTitle>
                    <p className="mt-1 text-sm text-text-muted">
                      Item masters, routing, work centers, and BOM libraries live here.
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardBody className="relative">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-surface/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Setup Focus</p>
                  <p className="mt-2 text-sm text-text">Finish mappings in sequence for smooth purchase → production → dispatch flow.</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-surface/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Recommended Next Step</p>
                  <p className="mt-2 text-sm text-text">Use <span className="font-medium">Process Flow</span> to check missing mappings and open the correct setup page.</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Status</p>
                <p className="mt-2 text-sm text-text-muted">Master data pages, imports, and mapping tools are available for onboarding.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/settings/master-data" className="flex-1 min-w-[220px]">
                  <Button className="w-full gap-2">
                    Manage Master Data
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/settings/import" className="flex-1 min-w-[220px]">
                  <Button className="w-full gap-2" variant="secondary">
                    Open CSV Import Center
                    <FileSpreadsheet className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardBody>
          </div>
        </Card>
      </div>

      <Card variant="strong" className="overflow-hidden border-border/60">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Master Data Workspace</CardTitle>
              <p className="mt-2 text-sm text-text-muted">
                Open each setup area to configure operations, costing, access, and master mappings.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface px-3 py-1 text-xs text-text-muted">
              <span className="inline-flex h-2 w-2 rounded-full bg-accent" />
              Dashboard-style quick access
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {masterTiles.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.accent} opacity-80`} />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-text shadow-sm">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="rounded-full border border-border/60 bg-surface/80 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-text-muted">
                        {item.category}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-text">{item.label}</p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-muted">{item.description}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent opacity-80 transition group-hover:opacity-100">
                      Open
                      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden border-border/60">
        <CardHeader className="pb-2">
          <CardTitle>Primary Contact</CardTitle>
          <p className="mt-2 text-sm text-text-muted">Use this for admin communication and setup support coordination.</p>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-bg-subtle/40 p-2">
              <Input label="Contact Name" placeholder="Riya Sharma" />
            </div>
            <div className="rounded-2xl border border-border/60 bg-bg-subtle/40 p-2">
              <Input label="Email Address" type="email" placeholder="riya@ragindustries.in" />
            </div>
            <div className="rounded-2xl border border-border/60 bg-bg-subtle/40 p-2">
              <Input label="Phone" placeholder="+91 98 0000 0000" />
            </div>
          </div>
        </CardBody>
      </Card>

      {auth?.employeeCode === "Techno" && (
        <div className="rounded-2xl border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.9))] p-1">
          <SampleDataCard />
        </div>
      )}
    </div>
  );
}
