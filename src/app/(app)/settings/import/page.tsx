"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { SectionHeader } from "@/components/SectionHeader";
import { ToastViewport } from "@/components/ToastViewport";
import { useToast } from "@/lib/use-toast";
import { apiGet } from "@/lib/api-client";

type ImportError = { row: number; field?: string; message: string };

type ImportResult = {
  imported: number;
  failed: number;
  errors: ImportError[];
};

type EntityConfig = {
  key: string;
  label: string;
  description: string;
  help: string;
};

const entities: EntityConfig[] = [
  {
    key: "warehouses",
    label: "Warehouses",
    description: "Storage locations (code, name).",
    help: "Import warehouses before zones."
  },
  {
    key: "zones",
    label: "Zones",
    description: "Operational zones linked to warehouses.",
    help: "Requires warehouseCode and type (RAW_MATERIAL/PRODUCTION/FINISHED/SCRAP/IN_TRANSIT)."
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Raw suppliers or subcontractors.",
    help: "Vendor type defaults to RAW if empty."
  },
  {
    key: "customers",
    label: "Customers",
    description: "Sales accounts and contacts.",
    help: "Use the template for address fields."
  },
  {
    key: "raw_skus",
    label: "Raw SKUs",
    description: "Inputs and materials (unit required).",
    help: "Duplicates are rejected. Inventory changes happen via Cycle Count (Admin only)."
  },
  {
    key: "finished_skus",
    label: "Finished SKUs",
    description: "Products (unit required).",
    help: "Duplicates are rejected. Inventory changes happen via Cycle Count (Admin only)."
  },
  {
    key: "machines",
    label: "Machines",
    description: "Assets and base capacity per minute.",
    help: "baseCapacityPerMinute is required."
  },
  {
    key: "employees",
    label: "Employees",
    description: "Operators, supervisors, and staff.",
    help: "Code and name are required."
  }
];

export default function ImportCenterPage() {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [results, setResults] = useState<Record<string, ImportResult | null>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toasts, push, remove } = useToast();

  const sortedEntities = useMemo(() => entities, []);

  useEffect(() => {
    apiGet<{ isAdmin: boolean }>("/api/active-user")
      .then((data) => setIsAdmin(Boolean(data.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  async function handleImport(entity: string) {
    const file = files[entity];
    if (!file) {
      push("error", "Select a CSV file before importing.");
      return;
    }

    setLoadingKey(entity);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/import/${entity}`, {
        method: "POST",
        body: form
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Import failed");
      }
      setResults((prev) => ({ ...prev, [entity]: payload.data as ImportResult }));
      push(
        "success",
        `Imported ${payload.data.imported} rows (${payload.data.failed} failed).`
      );
    } catch (error: any) {
      push("error", error.message ?? "Failed to import CSV");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="CSV Import Center"
        subtitle="Upload CSV files using system templates. Valid rows import; errors are reported."
      />

      <Card variant="strong">
        <CardHeader>
          <CardTitle>Recommended Order</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted">
            Warehouses → Zones → Vendors → Raw SKUs → Finished SKUs → Machines → Employees → Customers.
          </p>
          {!isAdmin ? (
            <p className="mt-2 text-sm text-danger">
              Admin role required. Select an Admin in the Active User dropdown before importing.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {sortedEntities.map((entity) => {
          const result = results[entity.key];
          return (
            <Card key={entity.key}>
              <CardHeader>
                <CardTitle>{entity.label}</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-text-muted">{entity.description}</p>
                <p className="mt-2 text-xs text-text-muted">{entity.help}</p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    className="text-sm font-semibold text-accent underline"
                    href={`/api/import/templates/${entity.key}`}
                  >
                    Download Template
                  </a>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) =>
                      setFiles((prev) => ({ ...prev, [entity.key]: event.target.files?.[0] ?? null }))
                    }
                  />
                  <Button
                    variant="secondary"
                    onClick={() => handleImport(entity.key)}
                    disabled={loadingKey === entity.key || !isAdmin}
                  >
                    {loadingKey === entity.key ? "Importing..." : "Import CSV"}
                  </Button>
                </div>

                {result ? (
                  <div className="mt-4 rounded-2xl border border-border/60 bg-bg-subtle/70 p-4 text-sm">
                    <p>
                      Imported: <span className="font-semibold">{result.imported}</span> · Failed:{" "}
                      <span className="font-semibold">{result.failed}</span>
                    </p>
                    {result.errors.length ? (
                      <ul className="mt-3 list-disc pl-5 text-xs text-text-muted">
                        {result.errors.slice(0, 8).map((error, idx) => (
                          <li key={`${error.row}-${idx}`}>
                            Row {error.row}
                            {error.field ? ` (${error.field})` : ""}: {error.message}
                          </li>
                        ))}
                        {result.errors.length > 8 ? (
                          <li>And {result.errors.length - 8} more errors…</li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
