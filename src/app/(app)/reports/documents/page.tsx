"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { apiGet } from "@/lib/api-client";

type DocumentRow = {
  id: string;
  type: "SALES_INVOICE" | "GOODS_RECEIPT" | "SALES_ORDER" | "PURCHASE_ORDER" | "VENDOR_BILL";
  number: string;
  party: string;
  amount: number;
  date: string;
  status: string;
  pdfUrl: string;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const typeLabels: Record<DocumentRow["type"], string> = {
  SALES_INVOICE: "Sales Invoice",
  GOODS_RECEIPT: "Goods Receipt",
  SALES_ORDER: "Sales Order",
  PURCHASE_ORDER: "Purchase Order",
  VENDOR_BILL: "Vendor Bill"
};

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const query = `?type=${encodeURIComponent(type)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(
          toDate
        )}&search=${encodeURIComponent(search)}`;
        const result = await apiGet<DocumentRow[]>(`/api/documents${query}`);
        setRows(result);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [type, fromDate, toDate, search]);

  const typeOptions = useMemo(
    () => [
      { value: "ALL", label: "All Documents" },
      { value: "SALES_INVOICE", label: "Sales Invoices" },
      { value: "GOODS_RECEIPT", label: "Goods Receipts" },
      { value: "SALES_ORDER", label: "Sales Orders" },
      { value: "PURCHASE_ORDER", label: "Purchase Orders" },
      { value: "VENDOR_BILL", label: "Vendor Bills" }
    ],
    []
  );

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="Documents"
        subtitle="Reference archive for all generated/printable documents."
        actions={
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            <Select label="Type" value={type} onChange={(event) => setType(event.target.value)} options={typeOptions} />
          </div>
        }
      />

      <Card>
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1">
              {[
                { key: "ALL", label: "All" },
                { key: "SALES_INVOICE", label: "Invoices" },
                { key: "GOODS_RECEIPT", label: "Receipts" },
                { key: "SALES_ORDER", label: "Sales Orders" },
                { key: "PURCHASE_ORDER", label: "Purchase Orders" },
                { key: "VENDOR_BILL", label: "Vendor Bills" },
              ].map((tab) => {
                const count = tab.key === "ALL" ? rows.length : rows.filter(r => r.type === tab.key).length;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setType(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${type === tab.key
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                      }`}
                  >
                    {tab.label} ({count})
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-3 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-56"
              />
            </div>
          </div>
        </div>
        <CardBody className="pt-3">
          <div className="max-h-[600px] overflow-y-auto">
            <DataTable
              columns={[
                { key: "type", label: "Type" },
                { key: "number", label: "Number" },
                { key: "party", label: "Party" },
                { key: "amount", label: "Amount", align: "right" as const },
                { key: "date", label: "Date" },
                { key: "status", label: "Status" },
                { key: "actions", label: "" }
              ]}
              rows={rows.map((row) => ({
                type: (() => {
                  const colorMap: Record<string, string> = {
                    SALES_INVOICE: "bg-green-50 text-green-700 border-green-200",
                    GOODS_RECEIPT: "bg-blue-50 text-blue-700 border-blue-200",
                    SALES_ORDER: "bg-yellow-50 text-yellow-700 border-yellow-200",
                    PURCHASE_ORDER: "bg-purple-50 text-purple-700 border-purple-200",
                    VENDOR_BILL: "bg-orange-50 text-orange-700 border-orange-200",
                  };
                  return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorMap[row.type] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                      {typeLabels[row.type]}
                    </span>
                  );
                })(),
                number: <span className="font-semibold text-accent">{row.number}</span>,
                party: <span className="font-medium">{row.party}</span>,
                amount: <span className="font-semibold text-green-600">{currency.format(row.amount)}</span>,
                date: new Date(row.date).toLocaleDateString("en-IN"),
                status: (() => {
                  const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
                    PAID: { bg: "bg-green-50 border-green-200", text: "text-green-700", dot: "bg-green-500" },
                    DRAFT: { bg: "bg-gray-100 border-gray-200", text: "text-gray-700", dot: "bg-gray-500" },
                    SENT: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
                    CONFIRMED: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", dot: "bg-yellow-500" },
                    APPROVED: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
                    RECEIVED: { bg: "bg-green-50 border-green-200", text: "text-green-700", dot: "bg-green-500" },
                    OVERDUE: { bg: "bg-red-50 border-red-200", text: "text-red-700", dot: "bg-red-500" },
                  };
                  const c = statusColors[row.status] ?? { bg: "bg-gray-100 border-gray-200", text: "text-gray-700", dot: "bg-gray-500" };
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {row.status}
                    </span>
                  );
                })(),
                actions: (
                  <div className="flex gap-2">
                    <a
                      href={row.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                    >
                      View
                    </a>
                    <a
                      href={row.pdfUrl}
                      download
                      className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      Download
                    </a>
                  </div>
                )
              }))}
              emptyLabel={loading ? "Loading documents..." : "No documents found for this filter."}
            />
          </div>
          <p className="px-2 py-2 text-xs text-text-muted text-center border-t border-gray-100 mt-2">
            {rows.length} document{rows.length !== 1 ? "s" : ""}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
