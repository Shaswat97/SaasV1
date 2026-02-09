"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type StockBalance = {
  id: string;
  quantityOnHand: number;
  costPerUnit: number;
  totalCost: number;
  zone: {
    id: string;
    name: string;
    type: string;
    warehouse: { name: string; code: string };
  };
  sku: {
    id: string;
    code: string;
    name: string;
    unit: string;
    sellingPrice?: number | null;
  };
};

type StockLedger = {
  id: string;
  direction: string;
  movementType: string;
  quantity: number;
  costPerUnit: number;
  totalCost: number;
  createdAt: string;
  zone: {
    id: string;
    name: string;
    warehouse: { name: string; code: string };
  };
  sku: {
    code: string;
    name: string;
    unit: string;
  };
};

type SummaryBucket = {
  label: string;
  qty: number;
  value: number;
};

const zoneTypeLabel: Record<string, string> = {
  RAW_MATERIAL: "Raw",
  PROCESSING_WIP: "WIP",
  FINISHED: "Finished",
  SCRAP: "Scrap",
  IN_TRANSIT: "In Transit"
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const number = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2
});

function formatQty(qty: number, unit: string) {
  return `${number.format(qty)} ${unit}`;
}

export default function InventoryPage() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [ledger, setLedger] = useState<StockLedger[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("ALL");
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleZoneId, setCycleZoneId] = useState("");
  const [cycleSkuId, setCycleSkuId] = useState("");
  const [cycleQty, setCycleQty] = useState("");
  const [cycleNotes, setCycleNotes] = useState("");
  const [cycleSubmitting, setCycleSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toasts, push, remove } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [balanceData, ledgerData] = await Promise.all([
        apiGet<StockBalance[]>("/api/stock/snapshot/by-zone"),
        apiGet<StockLedger[]>("/api/stock/ledger?limit=50")
      ]);
      setBalances(balanceData);
      setLedger(ledgerData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    apiGet<{ isAdmin: boolean }>("/api/active-user")
      .then((data) => setIsAdmin(Boolean(data.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  const zones = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    balances.forEach((balance) => {
      if (!map.has(balance.zone.id)) {
        map.set(balance.zone.id, {
          id: balance.zone.id,
          label: `${balance.zone.name} · ${balance.zone.warehouse.code}`
        });
      }
    });
    return Array.from(map.values());
  }, [balances]);

  const summary = useMemo(() => {
    const buckets = new Map<string, SummaryBucket>();
    balances.forEach((balance) => {
      const key = zoneTypeLabel[balance.zone.type] ?? "Other";
      const current = buckets.get(key) ?? { label: key, qty: 0, value: 0 };
      current.qty += balance.quantityOnHand;
      current.value += balance.totalCost;
      buckets.set(key, current);
    });
    return Array.from(buckets.values());
  }, [balances]);

  const filteredBalances = useMemo(() => {
    if (selectedZoneId === "ALL") return balances;
    return balances.filter((balance) => balance.zone.id === selectedZoneId);
  }, [balances, selectedZoneId]);

  const filteredLedger = useMemo(() => {
    if (selectedZoneId === "ALL") return ledger;
    return ledger.filter((entry) => entry.zone.id === selectedZoneId);
  }, [ledger, selectedZoneId]);

  const zoneOptions = useMemo(() => {
    return [{ value: "ALL", label: "All Zones" }, ...zones.map((zone) => ({ value: zone.id, label: zone.label }))];
  }, [zones]);

  const showZoneColumn = selectedZoneId === "ALL";

  const cycleZoneOptions = useMemo(
    () => zones.map((zone) => ({ value: zone.id, label: zone.label })),
    [zones]
  );

  const cycleSkuOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    balances
      .filter((balance) => (cycleZoneId ? balance.zone.id === cycleZoneId : true))
      .forEach((balance) => {
        if (!map.has(balance.sku.id)) {
          map.set(balance.sku.id, {
            value: balance.sku.id,
            label: `${balance.sku.code} · ${balance.sku.name}`
          });
        }
      });
    return Array.from(map.values());
  }, [balances, cycleZoneId]);

  const selectedBalance = useMemo(() => {
    return balances.find((balance) => balance.zone.id === cycleZoneId && balance.sku.id === cycleSkuId) ?? null;
  }, [balances, cycleZoneId, cycleSkuId]);

  useEffect(() => {
    if (!cycleZoneId && cycleZoneOptions.length) {
      setCycleZoneId(cycleZoneOptions[0].value);
    }
  }, [cycleZoneOptions, cycleZoneId]);

  useEffect(() => {
    if (!cycleSkuId && cycleSkuOptions.length) {
      setCycleSkuId(cycleSkuOptions[0].value);
    }
  }, [cycleSkuOptions, cycleSkuId]);

  const handleCycleSubmit = async () => {
    if (!cycleZoneId || !cycleSkuId) {
      push("error", "Select a zone and SKU");
      return;
    }
    const qtyValue = Number(cycleQty);
    if (Number.isNaN(qtyValue) || qtyValue < 0) {
      push("error", "Counted quantity must be 0 or more");
      return;
    }
    try {
      setCycleSubmitting(true);
      await apiSend("/api/stock/cycle-count", "POST", {
        zoneId: cycleZoneId,
        skuId: cycleSkuId,
        countedQty: qtyValue,
        notes: cycleNotes || undefined
      });
      push("success", "Cycle count posted");
      setCycleOpen(false);
      setCycleQty("");
      setCycleNotes("");
      await loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to post cycle count");
    } finally {
      setCycleSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Inventory"
        subtitle="Stock health by zone with valuation and selling exposure."
        actions={
          <Button
            onClick={() => {
              if (!isAdmin) {
                push("error", "Admin role required to run cycle counts.");
                return;
              }
              setCycleOpen(true);
            }}
            disabled={!isAdmin}
            title={!isAdmin ? "Admin only" : undefined}
          >
            Cycle Count
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {summary.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-text-muted">No inventory balances yet.</p>
            </CardBody>
          </Card>
        ) : (
          summary.map((bucket) => (
            <Card key={bucket.label}>
              <CardBody>
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{bucket.label}</p>
                <p className="mt-3 text-2xl font-semibold text-text">{number.format(bucket.qty)}</p>
                <p className="mt-2 text-sm text-text-muted">Value {currency.format(bucket.value)}</p>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zone Breakdown</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
            <Select
              label="Zone"
              value={selectedZoneId}
              onChange={(event) => setSelectedZoneId(event.target.value)}
              options={zoneOptions}
            />
            <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted">
              {selectedZoneId === "ALL"
                ? "Showing all zones."
                : "Showing SKUs in the selected zone."}
            </div>
          </div>

          <div className="mt-6">
            <DataTable
              columns={[
                ...(showZoneColumn ? [{ key: "zone", label: "Zone" }] : []),
                { key: "sku", label: "SKU" },
                { key: "qty", label: "Qty", align: "right" },
                { key: "cost", label: "Cost / Unit", align: "right" },
                { key: "value", label: "Stock Value", align: "right" },
                { key: "sell", label: "Sell / Unit", align: "right" },
                { key: "sellValue", label: "Sell Value", align: "right" }
              ]}
              rows={filteredBalances.map((balance) => {
                const sellUnit = balance.sku.sellingPrice ?? null;
                const sellValue = sellUnit ? sellUnit * balance.quantityOnHand : null;
                return {
                  zone: `${balance.zone.name} · ${balance.zone.warehouse.code}`,
                  sku: `${balance.sku.code} · ${balance.sku.name}`,
                  qty: formatQty(balance.quantityOnHand, balance.sku.unit),
                  cost: `${currency.format(balance.costPerUnit)} / ${balance.sku.unit}`,
                  value: currency.format(balance.totalCost),
                  sell: sellUnit ? `${currency.format(sellUnit)} / ${balance.sku.unit}` : "—",
                  sellValue: sellValue ? currency.format(sellValue) : "—"
                };
              })}
              emptyLabel={loading ? "Loading inventory..." : "No inventory for this view."}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
        </CardHeader>
        <CardBody>
          <DataTable
            columns={[
              { key: "date", label: "Date" },
              { key: "sku", label: "SKU" },
              { key: "zone", label: "Zone" },
              { key: "direction", label: "Dir" },
              { key: "qty", label: "Qty", align: "right" },
              { key: "cost", label: "Cost / Unit", align: "right" },
              { key: "value", label: "Total", align: "right" },
              { key: "type", label: "Type" }
            ]}
            rows={filteredLedger.map((entry) => ({
              date: new Date(entry.createdAt).toLocaleDateString("en-IN"),
              sku: `${entry.sku.code} · ${entry.sku.name}`,
              zone: `${entry.zone.name} · ${entry.zone.warehouse.code}`,
              direction: entry.direction,
              qty: formatQty(entry.quantity, entry.sku.unit),
              cost: `${currency.format(entry.costPerUnit)} / ${entry.sku.unit}`,
              value: currency.format(entry.totalCost),
              type: entry.movementType
            }))}
            emptyLabel={loading ? "Loading movements..." : "No movements recorded."}
          />
        </CardBody>
      </Card>

      <Modal
        open={cycleOpen}
        title="Cycle Count"
        onClose={() => setCycleOpen(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setCycleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCycleSubmit} disabled={cycleSubmitting || !isAdmin}>
              {cycleSubmitting ? "Posting..." : "Post Count"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Zone"
            value={cycleZoneId}
            onChange={(event) => {
              setCycleZoneId(event.target.value);
              setCycleSkuId("");
            }}
            options={cycleZoneOptions}
            required
          />
          <Select
            label="SKU"
            value={cycleSkuId}
            onChange={(event) => setCycleSkuId(event.target.value)}
            options={cycleSkuOptions.length ? cycleSkuOptions : [{ value: "", label: "No SKUs in zone" }]}
            required
          />
          <Input
            label="Current On Hand"
            value={
              selectedBalance
                ? `${formatQty(selectedBalance.quantityOnHand, selectedBalance.sku.unit)}`
                : "0"
            }
            readOnly
          />
          <Input
            label="Counted Quantity"
            type="number"
            value={cycleQty}
            onChange={(event) => setCycleQty(event.target.value)}
            required
          />
          <Input
            label="Notes"
            value={cycleNotes}
            onChange={(event) => setCycleNotes(event.target.value)}
            placeholder="Reason for adjustment"
          />
        </div>
      </Modal>

      <ToastViewport toasts={toasts} onDismiss={remove} />
    </div>
  );
}
