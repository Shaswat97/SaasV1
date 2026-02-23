"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { ToastViewport } from "@/components/ToastViewport";
import { apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

export function SampleDataCard() {
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toasts, push, remove } = useToast();

  async function loadSample() {
    setLoading(true);
    try {
      const result = await apiSend<{
        vendors: number;
        customers: number;
        employees: number;
        machines: number;
        rawSkus: number;
        finishedSkus: number;
      }>("/api/settings/sample-data", "POST");
      push(
        "success",
        `Loaded sample data: ${result.vendors} vendors, ${result.customers} customers, ${result.employees} employees.`
      );
    } catch (error: any) {
      push("error", error.message ?? "Failed to load sample data");
    } finally {
      setLoading(false);
    }
  }

  async function resetDemo() {
    if (!window.confirm("Reset all data? This will remove all transactions and master data (including warehouses and zones), keeping only the company record.")) {
      return;
    }
    setResetting(true);
    try {
      await apiSend("/api/settings/reset-data", "POST");
      push("success", "All data reset. Company kept; everything else cleared.");
    } catch (error: any) {
      push("error", error.message ?? "Failed to reset demo data");
    } finally {
      setResetting(false);
    }
  }

  async function saveCurrent() {
    if (!window.confirm("Save the current data as the new sample dataset? This will overwrite prisma/sample-data.json.")) {
      return;
    }
    setSaving(true);
    try {
      const result = await apiSend<{
        vendors: number;
        customers: number;
        employees: number;
        machines: number;
        skus: number;
        boms: number;
        machineSkus: number;
      }>("/api/settings/sample-data/save", "POST");
      push(
        "success",
        `Saved sample data: ${result.vendors} vendors, ${result.customers} customers, ${result.skus} SKUs.`
      );
    } catch (error: any) {
      push("error", error.message ?? "Failed to save sample data");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <Card variant="strong">
        <CardHeader>
          <CardTitle>Demo Data</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-3 text-sm text-text-muted">
            <p>Load a small, clean dataset for demos (3 raw SKUs, 2 finished SKUs, 2 vendors, 2 machines, 2 customers, 5 employees). Orders and POs are excluded.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={loadSample} disabled={loading || resetting || saving}>
                {loading ? "Loading..." : "Load Sample Data"}
              </Button>
              <Button variant="secondary" onClick={saveCurrent} disabled={loading || resetting || saving}>
                {saving ? "Saving..." : "Save Current as Sample"}
              </Button>
              <Button variant="ghost" onClick={resetDemo} disabled={loading || resetting || saving}>
                {resetting ? "Resetting..." : "Reset All Data"}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
