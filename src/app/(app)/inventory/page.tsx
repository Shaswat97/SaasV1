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
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
  zone: {
    id: string;
    name: string;
    type: string;
    warehouse: { name: string; code: string };
  };
  sku: {
    code: string;
    name: string;
    unit: string;
  };
};

type ScrapSaleLine = {
  id: string;
  quantity: number;
  unitPrice: number;
  costPerUnit: number;
  totalAmount: number;
  totalCost: number;
  sku: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
};

type ScrapSale = {
  id: string;
  saleNumber: string;
  buyerName: string;
  vendor?: {
    id: string;
    code: string;
    name: string;
  } | null;
  saleDate: string;
  totalAmount: number;
  totalCost: number;
  notes?: string | null;
  lines: ScrapSaleLine[];
};

type ScrapVendor = {
  id: string;
  code: string;
  name: string;
};

type ScrapSaleLineForm = {
  skuId: string;
  quantity: string;
  unitPrice: string;
};

type SummaryBucket = {
  label: string;
  zoneTypes: string[];
  qty: number;
  value: number;
};

type ZoneQuickFilter = {
  key: string;
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
  const [scrapSales, setScrapSales] = useState<ScrapSale[]>([]);
  const [scrapVendors, setScrapVendors] = useState<ScrapVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("ALL");
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleZoneId, setCycleZoneId] = useState("");
  const [cycleSkuId, setCycleSkuId] = useState("");
  const [cycleQty, setCycleQty] = useState("");
  const [cycleNotes, setCycleNotes] = useState("");
  const [cycleSubmitting, setCycleSubmitting] = useState(false);
  const [scrapBuyerName, setScrapBuyerName] = useState("");
  const [scrapVendorId, setScrapVendorId] = useState("");
  const [scrapSaleDate, setScrapSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [scrapNotes, setScrapNotes] = useState("");
  const [scrapLines, setScrapLines] = useState<ScrapSaleLineForm[]>([{ skuId: "", quantity: "", unitPrice: "" }]);
  const [scrapSubmitting, setScrapSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedSummaryLabel, setSelectedSummaryLabel] = useState<string | null>(null);
  const [selectedZoneType, setSelectedZoneType] = useState<string>("ALL");
  const [isAdmin, setIsAdmin] = useState(false);
  const { toasts, push, remove } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [balanceData, ledgerData, scrapData, vendorData] = await Promise.all([
        apiGet<StockBalance[]>("/api/stock/snapshot/by-zone"),
        apiGet<StockLedger[]>("/api/stock/ledger?limit=50"),
        apiGet<ScrapSale[]>("/api/scrap-sales").catch(() => []),
        apiGet<ScrapVendor[]>("/api/vendors?vendorType=SCRAP").catch(() => [])
      ]);
      setBalances(balanceData);
      setLedger(ledgerData);
      setScrapSales(Array.isArray(scrapData) ? scrapData : []);
      setScrapVendors(Array.isArray(vendorData) ? vendorData : []);
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
      const current = buckets.get(key) ?? { label: key, zoneTypes: [], qty: 0, value: 0 };
      if (!current.zoneTypes.includes(balance.zone.type)) {
        current.zoneTypes.push(balance.zone.type);
      }
      current.qty += balance.quantityOnHand;
      current.value += balance.totalCost;
      buckets.set(key, current);
    });
    return Array.from(buckets.values());
  }, [balances]);

  const selectedSummary = useMemo(
    () => summary.find((bucket) => bucket.label === selectedSummaryLabel) ?? null,
    [summary, selectedSummaryLabel]
  );

  const summaryLedgerRows = useMemo(() => {
    if (!selectedSummary) return [];
    return ledger.filter((entry) => selectedSummary.zoneTypes.includes(entry.zone.type)).slice(0, 200);
  }, [ledger, selectedSummary]);

  const summaryReferenceRows = useMemo(() => {
    if (!selectedSummary) return [];
    const aggregate = new Map<
      string,
      { referenceType: string; referenceId: string; entries: number; netQty: number; netValue: number; lastAt: string }
    >();
    summaryLedgerRows.forEach((entry) => {
      const referenceType = entry.referenceType ?? "UNLINKED";
      const referenceId = entry.referenceId ?? "—";
      const key = `${referenceType}:${referenceId}`;
      const sign = entry.direction === "IN" ? 1 : -1;
      const current = aggregate.get(key) ?? {
        referenceType,
        referenceId,
        entries: 0,
        netQty: 0,
        netValue: 0,
        lastAt: entry.createdAt
      };
      current.entries += 1;
      current.netQty += sign * entry.quantity;
      current.netValue += sign * entry.totalCost;
      if (new Date(entry.createdAt).getTime() > new Date(current.lastAt).getTime()) {
        current.lastAt = entry.createdAt;
      }
      aggregate.set(key, current);
    });
    return Array.from(aggregate.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
  }, [selectedSummary, summaryLedgerRows]);

  const zoneQuickFilters = useMemo(() => {
    const map = new Map<string, ZoneQuickFilter>();
    balances.forEach((balance) => {
      const key = balance.zone.type;
      const existing = map.get(key) ?? {
        key,
        label: zoneTypeLabel[key] ?? key,
        qty: 0,
        value: 0
      };
      existing.qty += balance.quantityOnHand;
      existing.value += balance.totalCost;
      map.set(key, existing);
    });
    const list = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    const total = list.reduce(
      (acc, item) => ({ qty: acc.qty + item.qty, value: acc.value + item.value }),
      { qty: 0, value: 0 }
    );
    return [{ key: "ALL", label: "All Zones", qty: total.qty, value: total.value }, ...list];
  }, [balances]);

  const filteredBalances = useMemo(() => {
    if (selectedZoneId !== "ALL") {
      return balances.filter((balance) => balance.zone.id === selectedZoneId);
    }
    if (selectedZoneType !== "ALL") {
      return balances.filter((balance) => balance.zone.type === selectedZoneType);
    }
    return balances;
  }, [balances, selectedZoneId, selectedZoneType]);

  const filteredLedger = useMemo(() => {
    if (selectedZoneId !== "ALL") {
      return ledger.filter((entry) => entry.zone.id === selectedZoneId);
    }
    if (selectedZoneType !== "ALL") {
      return ledger.filter((entry) => entry.zone.type === selectedZoneType);
    }
    return ledger;
  }, [ledger, selectedZoneId, selectedZoneType]);

  const movementRows = useMemo(
    () =>
      filteredLedger.map((entry) => ({
        date: new Date(entry.createdAt).toLocaleDateString("en-IN"),
        sku: `${entry.sku.code} · ${entry.sku.name}`,
        zone: `${entry.zone.name} · ${entry.zone.warehouse.code}`,
        direction: entry.direction,
        qty: formatQty(entry.quantity, entry.sku.unit),
        cost: `${currency.format(entry.costPerUnit)} / ${entry.sku.unit}`,
        value: currency.format(entry.totalCost),
        type: entry.movementType
      })),
    [filteredLedger]
  );

  const scrapBalances = useMemo(
    () => balances.filter((balance) => balance.zone.type === "SCRAP" && balance.quantityOnHand > 0),
    [balances]
  );

  const scrapBalanceBySku = useMemo(() => {
    const map = new Map<string, StockBalance>();
    scrapBalances.forEach((balance) => map.set(balance.sku.id, balance));
    return map;
  }, [scrapBalances]);

  const scrapSkuOptions = useMemo(
    () =>
      scrapBalances.map((balance) => ({
        value: balance.sku.id,
        label: `${balance.sku.code} · ${balance.sku.name} (On hand: ${number.format(balance.quantityOnHand)} ${balance.sku.unit})`
      })),
    [scrapBalances]
  );

  const scrapLastPriceByBuyerSku = useMemo(() => {
    const map = new Map<string, number>();
    scrapSales.forEach((sale) => {
      const buyerKey = sale.buyerName.trim().toLowerCase();
      sale.lines.forEach((line) => {
        const key = `${buyerKey}:${line.sku.id}`;
        if (!map.has(key)) {
          map.set(key, line.unitPrice);
        }
      });
    });
    return map;
  }, [scrapSales]);

  const getLastScrapPrice = (buyerName: string, skuId: string) => {
    const key = `${buyerName.trim().toLowerCase()}:${skuId}`;
    return scrapLastPriceByBuyerSku.get(key) ?? null;
  };

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

  useEffect(() => {
    if (!scrapSkuOptions.length) return;
    setScrapLines((prev) =>
      prev.map((line, index) =>
        line.skuId
          ? line
          : {
              ...line,
              skuId: index === 0 ? scrapSkuOptions[0].value : line.skuId
            }
      )
    );
  }, [scrapSkuOptions]);

  useEffect(() => {
    if (scrapVendorId) {
      const selected = scrapVendors.find((vendor) => vendor.id === scrapVendorId);
      if (selected) setScrapBuyerName(selected.name);
      return;
    }
    if (!scrapBuyerName && scrapVendors.length) {
      setScrapVendorId(scrapVendors[0].id);
      setScrapBuyerName(scrapVendors[0].name);
    }
  }, [scrapVendorId, scrapVendors, scrapBuyerName]);

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

  const updateScrapLine = (index: number, patch: Partial<ScrapSaleLineForm>) => {
    setScrapLines((prev) => prev.map((line, idx) => (idx === index ? { ...line, ...patch } : line)));
  };

  const handleScrapSubmit = async () => {
    const buyer = scrapBuyerName.trim();
    const vendorId = scrapVendorId || undefined;
    if (!buyer && !vendorId) {
      push("error", "Buyer name or scrap vendor is required");
      return;
    }
    if (!scrapLines.length) {
      push("error", "Add at least one scrap line");
      return;
    }

    const payloadLines = scrapLines.map((line) => ({
      skuId: line.skuId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice)
    }));

    if (payloadLines.some((line) => !line.skuId)) {
      push("error", "Select SKU for all scrap lines");
      return;
    }
    if (payloadLines.some((line) => Number.isNaN(line.quantity) || line.quantity <= 0)) {
      push("error", "Scrap quantity must be greater than 0");
      return;
    }
    if (payloadLines.some((line) => Number.isNaN(line.unitPrice) || line.unitPrice <= 0)) {
      push("error", "Unit price must be greater than 0");
      return;
    }

    const totalBySku = new Map<string, number>();
    for (const line of payloadLines) {
      totalBySku.set(line.skuId, (totalBySku.get(line.skuId) ?? 0) + line.quantity);
    }
    for (const [skuId, qty] of totalBySku.entries()) {
      const available = scrapBalanceBySku.get(skuId)?.quantityOnHand ?? 0;
      if (qty > available) {
        const balance = scrapBalanceBySku.get(skuId);
        const label = balance ? `${balance.sku.code} · ${balance.sku.name}` : skuId;
        push("error", `Insufficient scrap stock for ${label}`);
        return;
      }
    }

    try {
      setScrapSubmitting(true);
      const saleDateIso = scrapSaleDate ? new Date(scrapSaleDate).toISOString() : new Date().toISOString();
      await apiSend("/api/scrap-sales", "POST", {
        buyerName: buyer || undefined,
        vendorId,
        saleDate: saleDateIso,
        notes: scrapNotes.trim() || undefined,
        lines: payloadLines
      });
      push("success", "Scrap sale recorded");
      if (!vendorId) setScrapBuyerName("");
      setScrapSaleDate(new Date().toISOString().slice(0, 10));
      setScrapNotes("");
      setScrapLines([{ skuId: scrapSkuOptions[0]?.value ?? "", quantity: "", unitPrice: "" }]);
      await loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to record scrap sale");
    } finally {
      setScrapSubmitting(false);
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
                push("error", "Admin permission required to run cycle counts.");
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
            <button
              key={bucket.label}
              type="button"
              className="h-full text-left"
              onClick={() => {
                setSelectedSummaryLabel(bucket.label);
                setSummaryOpen(true);
              }}
            >
              <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                <CardBody className="flex min-h-[140px] flex-col justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{bucket.label}</p>
                  <p className="text-2xl font-semibold text-text">{number.format(bucket.qty)}</p>
                  <p className="text-sm text-text-muted">Value {currency.format(bucket.value)}</p>
                </CardBody>
              </Card>
            </button>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zone Breakdown</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid items-start gap-4 lg:grid-cols-[3.6fr_1.4fr]">
              <div className="space-y-2">
                <span className="text-sm text-text-muted">Quick Filters</span>
                <div className="flex flex-wrap gap-2">
                  {zoneQuickFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      aria-pressed={selectedZoneType === filter.key && selectedZoneId === "ALL"}
                      onClick={() => {
                        setSelectedZoneType(filter.key);
                        setSelectedZoneId("ALL");
                      }}
                      className={`min-w-[126px] rounded-2xl border px-4 py-3 text-left transition ${
                        selectedZoneType === filter.key && selectedZoneId === "ALL"
                          ? "border-primary/60 bg-primary/15 text-primary shadow-sm"
                          : "border-border/60 bg-surface hover:border-primary/40 hover:bg-bg-subtle/80"
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{filter.label}</div>
                      <div className="mt-1 text-sm font-semibold text-text">{number.format(filter.qty)}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="lg:max-w-[460px]">
                <Select
                  label="Zone"
                  value={selectedZoneId}
                  onChange={(event) => {
                    setSelectedZoneId(event.target.value);
                    setSelectedZoneType("ALL");
                  }}
                  options={zoneOptions}
                />
              </div>
              <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted lg:col-span-2">
                {selectedZoneId !== "ALL"
                  ? "Showing SKUs in the selected zone."
                  : selectedZoneType === "ALL"
                    ? "Showing all zones."
                    : `Showing ${zoneTypeLabel[selectedZoneType] ?? selectedZoneType} zones.`}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 text-xs text-text-muted">
                Showing all {filteredBalances.length} entries · Scroll to view more
              </div>
              <div className="max-h-[520px] overflow-y-auto pr-1">
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
            </div>
          </CardBody>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-text-muted">
            <span>Showing all {movementRows.length} entries · Scroll to view more</span>
          </div>
          <div className="max-h-[540px] overflow-y-auto pr-1">
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
              rows={movementRows}
              emptyLabel={loading ? "Loading movements..." : "No movements recorded."}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scrap Sales</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-6 xl:grid-cols-[1.6fr_2fr]">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-bg-subtle/80 p-4">
              <Select
                label="Scrap Vendor"
                value={scrapVendorId}
                onChange={(event) => setScrapVendorId(event.target.value)}
                options={[
                  { value: "", label: "Manual Buyer (not in vendor master)" },
                  ...scrapVendors.map((vendor) => ({
                    value: vendor.id,
                    label: `${vendor.code} · ${vendor.name}`
                  }))
                ]}
              />
              <Input
                label="Buyer Name"
                value={scrapBuyerName}
                onChange={(event) => setScrapBuyerName(event.target.value)}
                placeholder="Scrap buyer / recycler"
                required={!scrapVendorId}
                disabled={Boolean(scrapVendorId)}
                hint={scrapVendorId ? "Buyer name is sourced from selected scrap vendor." : undefined}
              />
              <Input
                label="Sale Date"
                type="date"
                value={scrapSaleDate}
                onChange={(event) => setScrapSaleDate(event.target.value)}
                required
              />
              <Input
                label="Notes"
                value={scrapNotes}
                onChange={(event) => setScrapNotes(event.target.value)}
                placeholder="Transport, weighbridge reference, etc."
              />

              {scrapLines.map((line, index) => {
                const balance = line.skuId ? scrapBalanceBySku.get(line.skuId) : null;
                const options = scrapSkuOptions.length
                  ? scrapSkuOptions
                  : [{ value: "", label: "No scrap stock available" }];
                return (
                  <div key={`${line.skuId}-${index}`} className="rounded-2xl border border-border/60 bg-bg-surface p-3">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <Select
                        label="Scrap SKU"
                        value={line.skuId}
                        onChange={(event) => {
                          const nextSkuId = event.target.value;
                          const lastPrice = getLastScrapPrice(scrapBuyerName, nextSkuId);
                          updateScrapLine(index, {
                            skuId: nextSkuId,
                            unitPrice: line.unitPrice || (lastPrice ? String(lastPrice) : "")
                          });
                        }}
                        options={options}
                        required
                      />
                      <Input
                        label="Qty"
                        type="number"
                        value={line.quantity}
                        onChange={(event) => updateScrapLine(index, { quantity: event.target.value })}
                        required
                      />
                      <Input
                        label="Unit Price"
                        type="number"
                        value={line.unitPrice}
                        onChange={(event) => updateScrapLine(index, { unitPrice: event.target.value })}
                        required
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                      <span>
                        {balance
                          ? `Available ${number.format(balance.quantityOnHand)} ${balance.sku.unit} · Cost ${currency.format(
                              balance.costPerUnit
                            )}/${balance.sku.unit}`
                          : "Select a SKU from Scrap zone."}
                      </span>
                      {line.skuId && getLastScrapPrice(scrapBuyerName, line.skuId) ? (
                        <span>
                          Last deal price: {currency.format(getLastScrapPrice(scrapBuyerName, line.skuId) ?? 0)}
                        </span>
                      ) : null}
                      {scrapLines.length > 1 ? (
                        <button
                          type="button"
                          className="text-danger"
                          onClick={() => setScrapLines((prev) => prev.filter((_, idx) => idx !== index))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setScrapLines((prev) => [...prev, { skuId: scrapSkuOptions[0]?.value ?? "", quantity: "", unitPrice: "" }])
                  }
                  disabled={!scrapSkuOptions.length}
                >
                  Add Line
                </Button>
                <Button
                  type="button"
                  onClick={handleScrapSubmit}
                  disabled={scrapSubmitting || !scrapSkuOptions.length}
                >
                  {scrapSubmitting ? "Posting..." : "Record Scrap Sale"}
                </Button>
              </div>
            </div>

            <div>
              <DataTable
                columns={[
                  { key: "sale", label: "Sale" },
                  { key: "buyer", label: "Buyer" },
                  { key: "date", label: "Date" },
                  { key: "amount", label: "Amount", align: "right" },
                  { key: "cost", label: "Cost", align: "right" },
                  { key: "margin", label: "Margin", align: "right" },
                  { key: "lines", label: "Lines" }
                ]}
                rows={scrapSales.map((sale) => ({
                  sale: sale.saleNumber,
                  buyer: sale.vendor ? `${sale.vendor.code} · ${sale.vendor.name}` : sale.buyerName,
                  date: new Date(sale.saleDate).toLocaleDateString("en-IN"),
                  amount: currency.format(sale.totalAmount),
                  cost: currency.format(sale.totalCost),
                  margin: currency.format(sale.totalAmount - sale.totalCost),
                  lines: sale.lines
                    .map((line) => `${line.sku.code}: ${number.format(line.quantity)} @ ${currency.format(line.unitPrice)}`)
                    .join(" · ")
                }))}
                emptyLabel={loading ? "Loading scrap sales..." : "No scrap sales recorded yet."}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={summaryOpen}
        title={selectedSummary ? `${selectedSummary.label} Stock Composition` : "Stock Composition"}
        onClose={() => setSummaryOpen(false)}
        className="max-w-6xl"
      >
        <div className="space-y-6">
          <p className="text-sm text-text-muted">
            This shows stock movements and source references currently contributing to the selected inventory bucket.
          </p>

          <DataTable
            columns={[
              { key: "referenceType", label: "Source Type" },
              { key: "referenceId", label: "Source Id" },
              { key: "entries", label: "Movements", align: "right" },
              { key: "netQty", label: "Net Qty", align: "right" },
              { key: "netValue", label: "Net Value", align: "right" },
              { key: "lastAt", label: "Last Movement" }
            ]}
            rows={summaryReferenceRows.map((row) => ({
              referenceType: row.referenceType,
              referenceId: row.referenceId,
              entries: number.format(row.entries),
              netQty: number.format(row.netQty),
              netValue: currency.format(row.netValue),
              lastAt: new Date(row.lastAt).toLocaleString("en-IN")
            }))}
            emptyLabel="No reference-level movements found for this bucket."
          />

          <DataTable
            columns={[
              { key: "date", label: "Date" },
              { key: "source", label: "Source" },
              { key: "sku", label: "SKU" },
              { key: "zone", label: "Zone" },
              { key: "direction", label: "Dir" },
              { key: "qty", label: "Qty", align: "right" },
              { key: "cost", label: "Cost / Unit", align: "right" },
              { key: "total", label: "Total", align: "right" }
            ]}
            rows={summaryLedgerRows.map((entry) => ({
              date: new Date(entry.createdAt).toLocaleString("en-IN"),
              source: entry.referenceType ? `${entry.referenceType}${entry.referenceId ? ` · ${entry.referenceId}` : ""}` : "—",
              sku: `${entry.sku.code} · ${entry.sku.name}`,
              zone: `${entry.zone.name} · ${entry.zone.warehouse.code}`,
              direction: entry.direction,
              qty: formatQty(entry.quantity, entry.sku.unit),
              cost: `${currency.format(entry.costPerUnit)} / ${entry.sku.unit}`,
              total: currency.format(entry.totalCost)
            }))}
            emptyLabel="No movement data found for this bucket."
          />
        </div>
      </Modal>

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
