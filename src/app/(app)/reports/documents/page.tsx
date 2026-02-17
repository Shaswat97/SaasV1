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
        <CardHeader>
          <CardTitle>All Documents</CardTitle>
        </CardHeader>
        <CardBody>
          <Input
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by number, party, or type"
          />
          <div className="mt-6">
            <DataTable
              columns={[
                { key: "type", label: "Type" },
                { key: "number", label: "Number" },
                { key: "party", label: "Party" },
                { key: "amount", label: "Amount", align: "right" },
                { key: "date", label: "Date" },
                { key: "status", label: "Status" },
                { key: "actions", label: "" }
              ]}
              rows={rows.map((row) => ({
                type: typeLabels[row.type],
                number: row.number,
                party: row.party,
                amount: currency.format(row.amount),
                date: new Date(row.date).toLocaleDateString("en-IN"),
                status: row.status,
                actions: (
                  <div className="flex gap-3">
                    <a
                      href={row.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-accent hover:underline"
                    >
                      View
                    </a>
                    <a href={row.pdfUrl} download className="text-sm text-accent hover:underline">
                      Download
                    </a>
                  </div>
                )
              }))}
              emptyLabel={loading ? "Loading documents..." : "No documents found for this filter."}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
