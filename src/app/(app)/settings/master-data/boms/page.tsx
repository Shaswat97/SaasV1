"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { SectionHeader } from "@/components/SectionHeader";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type FinishedSku = { id: string; code: string; name: string };

type RawSku = { id: string; code: string; name: string };

type BomLine = { rawSkuId: string; quantity: number; scrapPct?: number | null };

type Bom = {
  id: string;
  finishedSkuId: string;
  finishedSku: FinishedSku;
  version: number;
  name?: string | null;
  lines: { rawSkuId: string; quantity: number; scrapPct?: number | null; rawSku: RawSku }[];
};

export default function BomsPage() {
  const [boms, setBoms] = useState<Bom[]>([]);
  const [finishedSkus, setFinishedSkus] = useState<FinishedSku[]>([]);
  const [rawSkus, setRawSkus] = useState<RawSku[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [finishedSkuId, setFinishedSkuId] = useState("");
  const [lines, setLines] = useState<BomLine[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [bomData, finishedData, rawData] = await Promise.all([
        apiGet<Bom[]>("/api/boms"),
        apiGet<FinishedSku[]>("/api/finished-skus"),
        apiGet<RawSku[]>("/api/raw-skus")
      ]);
      setBoms(bomData);
      setFinishedSkus(finishedData);
      setRawSkus(rawData);
      if (!finishedSkuId && finishedData[0]) {
        setFinishedSkuId(finishedData[0].id);
      }
    } catch (error: any) {
      push("error", error.message ?? "Failed to load BOMs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishedOptions = useMemo(
    () => finishedSkus.map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name}` })),
    [finishedSkus]
  );

  const rawOptions = useMemo(
    () => rawSkus.map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name}` })),
    [rawSkus]
  );

  function addLine() {
    if (rawSkus.length === 0) return;
    setLines((prev) => [...prev, { rawSkuId: rawSkus[0].id, quantity: 1 }]);
  }

  function resetForm() {
    setEditingId(null);
    setLines([]);
  }

  function handleEdit(bom: Bom) {
    setEditingId(bom.id);
    setFinishedSkuId(bom.finishedSkuId);
    setLines(
      bom.lines.map((line) => ({
        rawSkuId: line.rawSkuId,
        quantity: line.quantity,
        scrapPct: line.scrapPct ?? undefined
      }))
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!finishedSkuId) {
      push("error", "Select a finished SKU");
      return;
    }
    if (lines.length === 0) {
      push("error", "Add at least one BOM line");
      return;
    }

    const payload = {
      finishedSkuId,
      lines: lines.map((line) => ({
        rawSkuId: line.rawSkuId,
        quantity: Number(line.quantity),
        scrapPct: line.scrapPct ? Number(line.scrapPct) : undefined
      }))
    };

    try {
      if (editingId) {
        await apiSend(`/api/boms/${editingId}`, "PUT", payload);
        push("success", "BOM updated");
      } else {
        await apiSend("/api/boms", "POST", payload);
        push("success", "BOM created");
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save BOM");
    }
  }

  const filtered = boms.filter((bom) => {
    const target = `${bom.finishedSku.code} ${bom.finishedSku.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader title="BOMs" subtitle="Configure raw material recipes for finished SKUs." />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit BOM" : "Create BOM"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Select
                label="Finished SKU"
                value={finishedSkuId}
                onChange={(event) => setFinishedSkuId(event.target.value)}
                options={finishedOptions}
                required
              />
              <div className="space-y-3">
                {lines.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-sm text-text-muted">
                    Add BOM lines to define required raw materials.
                  </div>
                ) : (
                  lines.map((line, index) => (
                    <div
                      key={`${line.rawSkuId}-${index}`}
                      className="grid gap-3 rounded-2xl border border-border/60 bg-bg-subtle/70 p-3 lg:grid-cols-[2fr_1fr_1fr_auto]"
                    >
                      <Select
                        label="Raw SKU"
                        value={line.rawSkuId}
                        onChange={(event) => {
                          const value = event.target.value;
                          setLines((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, rawSkuId: value } : item))
                          );
                        }}
                        options={rawOptions}
                      />
                      <Input
                        label="Quantity"
                        value={line.quantity.toString()}
                        onChange={(event) => {
                          const value = event.target.value;
                          setLines((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, quantity: Number(value) } : item))
                          );
                        }}
                        type="number"
                        required
                      />
                      <Input
                        label="Scrap %"
                        value={line.scrapPct?.toString() ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setLines((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, scrapPct: value ? Number(value) : undefined } : item
                            )
                          );
                        }}
                        type="number"
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={addLine}>
                  Add BOM Line
                </Button>
                <Button type="submit">{editingId ? "Save Changes" : "Create BOM"}</Button>
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BOM Library</CardTitle>
          </CardHeader>
          <CardBody>
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by finished SKU"
            />
            <div className="mt-6">
              <DataTable
                columns={[
                  { key: "finished", label: "Finished SKU" },
                  { key: "version", label: "Version" },
                  { key: "name", label: "Name" },
                  { key: "lines", label: "Lines", align: "right" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((bom) => ({
                  finished: bom.finishedSku.name,
                  version: `v${bom.version}`,
                  name: bom.name ?? "—",
                  lines: bom.lines.length,
                  actions: (
                    <Button variant="ghost" onClick={() => handleEdit(bom)}>
                      Edit
                    </Button>
                  )
                }))}
                emptyLabel={loading ? "Loading BOMs..." : "No BOMs found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
