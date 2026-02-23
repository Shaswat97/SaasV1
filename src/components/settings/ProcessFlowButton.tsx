"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Workflow } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Warehouse = { id: string; code: string; name: string };
type Zone = { id: string; code: string; name: string; type: string };
type Vendor = { id: string; vendorType?: string | null };
type Sku = { id: string; code: string; name: string };
type VendorSku = { id: string; vendorId: string; skuId: string };
type Machine = { id: string; code: string; name: string };
type MachineSku = { id: string; machineId: string; skuId: string };
type Bom = { id: string; finishedSkuId: string; lines?: Array<{ id: string }> };

type SetupSnapshot = {
  warehouses: Warehouse[];
  zones: Zone[];
  vendors: Vendor[];
  rawSkus: Sku[];
  finishedSkus: Sku[];
  vendorSkus: VendorSku[];
  machines: Machine[];
  machineSkus: MachineSku[];
  boms: Bom[];
};

type ProcessStep = {
  id: string;
  title: string;
  href: string;
  importance: string;
  helps: string;
  statusText: string;
  complete: boolean;
};

const REQUIRED_ZONE_TYPES = ["RAW_MATERIAL", "PROCESSING_WIP", "FINISHED", "SCRAP", "IN_TRANSIT"] as const;

export function ProcessFlowButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SetupSnapshot | null>(null);

  async function loadSnapshot() {
    setLoading(true);
    setError(null);
    try {
      const [
        warehouses,
        zones,
        vendors,
        rawSkus,
        finishedSkus,
        vendorSkus,
        machines,
        machineSkus,
        boms
      ] = await Promise.all([
        apiGet<Warehouse[]>("/api/warehouses"),
        apiGet<Zone[]>("/api/zones"),
        apiGet<Vendor[]>("/api/vendors"),
        apiGet<Sku[]>("/api/raw-skus"),
        apiGet<Sku[]>("/api/finished-skus"),
        apiGet<VendorSku[]>("/api/vendor-skus"),
        apiGet<Machine[]>("/api/machines"),
        apiGet<MachineSku[]>("/api/machine-skus"),
        apiGet<Bom[]>("/api/boms")
      ]);

      setSnapshot({
        warehouses,
        zones,
        vendors,
        rawSkus,
        finishedSkus,
        vendorSkus,
        machines,
        machineSkus,
        boms
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to load setup process status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSnapshot();
  }, []);

  const steps = useMemo<ProcessStep[]>(() => {
    if (!snapshot) {
      return [];
    }

    const zoneTypeSet = new Set(snapshot.zones.map((zone) => zone.type));
    const missingZoneTypes = REQUIRED_ZONE_TYPES.filter((type) => !zoneTypeSet.has(type));
    const rawVendors = snapshot.vendors.filter((vendor) => (vendor.vendorType ?? "RAW") === "RAW");
    const rawSkuIdSet = new Set(snapshot.rawSkus.map((sku) => sku.id));
    const finishedSkuIdSet = new Set(snapshot.finishedSkus.map((sku) => sku.id));
    const machineIdSet = new Set(snapshot.machines.map((machine) => machine.id));
    const vendorRawMappings = snapshot.vendorSkus.filter((mapping) => rawSkuIdSet.has(mapping.skuId));
    const machineFinishedMappings = snapshot.machineSkus.filter(
      (mapping) => machineIdSet.has(mapping.machineId) && finishedSkuIdSet.has(mapping.skuId)
    );
    const bomsWithLines = snapshot.boms.filter((bom) => (bom.lines?.length ?? 0) > 0);

    return [
      {
        id: "warehouses",
        title: "Create Warehouse",
        href: "/settings/master-data/warehouses",
        importance: "First, add your warehouse. This tells the system where your stock is kept.",
        helps: "You can then receive goods, store items, move stock, and track stock value for that place.",
        statusText: `${snapshot.warehouses.length} warehouse${snapshot.warehouses.length === 1 ? "" : "s"} configured`,
        complete: snapshot.warehouses.length > 0
      },
      {
        id: "zones",
        title: "Define Operational Zones",
        href: "/settings/master-data/zones",
        importance: "Zones divide your warehouse into work areas like Raw, WIP, Finished, Scrap, and In-Transit.",
        helps: "This helps the system know where material is now and where it should move next.",
        statusText:
          missingZoneTypes.length === 0
            ? `${snapshot.zones.length} zones ready (all required types available)`
            : `Missing zone types: ${missingZoneTypes.join(", ")}`,
        complete: missingZoneTypes.length === 0
      },
      {
        id: "vendors",
        title: "Create Vendors",
        href: "/settings/master-data/vendors",
        importance: "Add your suppliers before making purchase orders and receiving material.",
        helps: "You can track who supplied what, compare prices, and manage vendor bills easily.",
        statusText: `${rawVendors.length} raw vendor${rawVendors.length === 1 ? "" : "s"} available`,
        complete: rawVendors.length > 0
      },
      {
        id: "skus",
        title: "Create Raw + Finished SKUs",
        href: "/settings/master-data/raw-skus",
        importance: "SKUs are the item names/codes used in the system for raw materials and finished goods.",
        helps: "Once SKUs are added, you can use them in purchase, production, sales, and inventory screens.",
        statusText: `${snapshot.rawSkus.length} raw SKUs · ${snapshot.finishedSkus.length} finished SKUs`,
        complete: snapshot.rawSkus.length > 0 && snapshot.finishedSkus.length > 0
      },
      {
        id: "vendor-skus",
        title: "Map Vendors to Raw SKUs",
        href: "/settings/master-data/vendors",
        importance: "Link each raw material to the suppliers who can provide it.",
        helps: "This shows expected purchase price and helps create POs faster when stock is low.",
        statusText: `${vendorRawMappings.length} vendor-to-raw SKU mappings`,
        complete: vendorRawMappings.length > 0
      },
      {
        id: "machines",
        title: "Create Machines and Capacity Mapping",
        href: "/settings/master-data/machines-routing",
        importance: "Add your machines and tell the system which finished items each machine can make.",
        helps: "The system can estimate production speed, plan work better, and avoid over-promising delivery.",
        statusText: `${snapshot.machines.length} machines · ${machineFinishedMappings.length} machine-SKU mappings`,
        complete: snapshot.machines.length > 0 && machineFinishedMappings.length > 0
      },
      {
        id: "boms",
        title: "Map BOMs for Finished SKUs",
        href: "/settings/master-data/boms",
        importance: "BOM tells the system which raw materials are needed to make a finished product.",
        helps: "This helps check shortages, record material used in production, and calculate product cost.",
        statusText: `${bomsWithLines.length} BOM${bomsWithLines.length === 1 ? "" : "s"} with lines`,
        complete: bomsWithLines.length > 0
      },
      {
        id: "csv-import",
        title: "Use CSV Import for Bulk Onboarding (Optional)",
        href: "/settings/import",
        importance: "Use CSV import if you already have data in Excel and want faster setup.",
        helps: "It saves manual typing time and helps upload many records together.",
        statusText: "Optional accelerator for large master-data loads",
        complete: true
      }
    ];
  }, [snapshot]);

  const requiredSteps = steps.filter((step) => step.id !== "csv-import");
  const completedRequired = requiredSteps.filter((step) => step.complete).length;
  const hasMissingMappings = requiredSteps.some((step) => !step.complete);

  const buttonLabel = loading
    ? "Process Flow (Checking...)"
    : error
      ? "Process Flow (Status Error)"
      : `Process Flow (${completedRequired}/${requiredSteps.length} Ready)`;

  return (
    <>
      <Button
        variant="secondary"
        className={cn(
          "gap-2 border",
          hasMissingMappings
            ? "border-danger/40 bg-danger/15 text-danger hover:bg-danger/20"
            : "border-success/30 bg-success/15 text-text hover:bg-success/20",
          error && "border-warning/40 bg-warning/15 text-text"
        )}
        onClick={() => setOpen(true)}
      >
        <Workflow className="h-4 w-4" />
        {buttonLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Master Data Process Flow"
        className="max-w-5xl"
        actions={
          <>
            <Button variant="secondary" onClick={loadSnapshot} disabled={loading} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh Status
            </Button>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div
            className={cn(
              "rounded-2xl border p-4",
              hasMissingMappings ? "border-danger/30 bg-danger/5" : "border-success/30 bg-success/5"
            )}
          >
            <div className="flex flex-wrap items-start gap-3">
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full",
                  hasMissingMappings ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
                )}
              >
                {hasMissingMappings ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">
                  {hasMissingMappings
                    ? "Setup is not complete yet. Some important links are missing."
                    : "Main setup is complete. You can start purchase, production, and sales work."}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  Follow the steps below in order. Each step shows why it is needed and how it helps your daily work.
                </p>
                {!error && snapshot ? (
                  <p className="mt-2 text-xs text-text-muted">
                    Readiness: {completedRequired}/{requiredSteps.length} required steps complete
                  </p>
                ) : null}
                {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
              </div>
            </div>
          </div>

          {loading && !snapshot ? (
            <div className="rounded-2xl border border-border/60 bg-bg-subtle/60 p-6 text-sm text-text-muted">
              Loading setup status...
            </div>
          ) : null}

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "rounded-2xl border p-4",
                  step.complete ? "border-border/60 bg-surface" : "border-danger/30 bg-danger/5"
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-bg-subtle px-2 text-xs font-semibold text-text">
                        {index + 1}
                      </span>
                      <p className="text-sm font-semibold text-text">{step.title}</p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                          step.complete ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                        )}
                      >
                        {step.complete ? "Mapped" : "Pending"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-text-muted">
                      <span className="font-semibold uppercase tracking-[0.12em]">Status</span>: {step.statusText}
                    </p>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-bg-subtle/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Why This Is Important</p>
                        <p className="mt-1 text-sm text-text">{step.importance}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-bg-subtle/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">How This Helps</p>
                        <p className="mt-1 text-sm text-text">{step.helps}</p>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-accent/50 hover:text-accent"
                    onClick={() => setOpen(false)}
                  >
                    Open
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
