"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/Input";
import { SectionHeader } from "@/components/SectionHeader";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type Company = {
  id: string;
  name: string;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  billingLine1?: string | null;
  billingLine2?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
};

const emptyForm = {
  name: "",
  gstin: "",
  phone: "",
  email: "",
  billingLine1: "",
  billingLine2: "",
  billingCity: "",
  billingState: "",
  billingPostalCode: "",
  billingCountry: "",
  shippingLine1: "",
  shippingLine2: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: ""
};

function buildAddress(fields: typeof emptyForm, prefix: "billing" | "shipping") {
  return {
    line1: fields[`${prefix}Line1` as keyof typeof emptyForm] || undefined,
    line2: fields[`${prefix}Line2` as keyof typeof emptyForm] || undefined,
    city: fields[`${prefix}City` as keyof typeof emptyForm] || undefined,
    state: fields[`${prefix}State` as keyof typeof emptyForm] || undefined,
    postalCode: fields[`${prefix}PostalCode` as keyof typeof emptyForm] || undefined,
    country: fields[`${prefix}Country` as keyof typeof emptyForm] || undefined
  };
}

export default function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toasts, push, remove } = useToast();

  async function loadCompanies() {
    setLoading(true);
    try {
      const data = await apiGet<Company[]>("/api/companies");
      setCompanies(data);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEdit(company: Company) {
    setEditingId(company.id);
    setForm({
      name: company.name ?? "",
      gstin: company.gstin ?? "",
      phone: company.phone ?? "",
      email: company.email ?? "",
      billingLine1: company.billingLine1 ?? "",
      billingLine2: company.billingLine2 ?? "",
      billingCity: company.billingCity ?? "",
      billingState: company.billingState ?? "",
      billingPostalCode: company.billingPostalCode ?? "",
      billingCountry: company.billingCountry ?? "",
      shippingLine1: company.shippingLine1 ?? "",
      shippingLine2: company.shippingLine2 ?? "",
      shippingCity: company.shippingCity ?? "",
      shippingState: company.shippingState ?? "",
      shippingPostalCode: company.shippingPostalCode ?? "",
      shippingCountry: company.shippingCountry ?? ""
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const payload = {
      name: form.name,
      gstin: form.gstin || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      billingAddress: buildAddress(form, "billing"),
      shippingAddress: buildAddress(form, "shipping")
    };

    try {
      if (editingId) {
        await apiSend(`/api/companies/${editingId}`, "PUT", payload);
        push("success", "Company updated");
      } else {
        await apiSend("/api/companies", "POST", payload);
        push("success", "Company created");
      }
      resetForm();
      loadCompanies();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save company");
    }
  }

  const filtered = companies.filter((company) =>
    company.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Company"
        subtitle="Single-tenant company record for billing, shipping, and compliance."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Company" : "Add Company"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Company Name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="GSTIN"
                  value={form.gstin}
                  onChange={(event) => setForm({ ...form, gstin: event.target.value })}
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <Input
                label="Email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                type="email"
              />

              <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Billing Address</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Line 1"
                    value={form.billingLine1}
                    onChange={(event) => setForm({ ...form, billingLine1: event.target.value })}
                  />
                  <Input
                    label="Line 2"
                    value={form.billingLine2}
                    onChange={(event) => setForm({ ...form, billingLine2: event.target.value })}
                  />
                  <Input
                    label="City"
                    value={form.billingCity}
                    onChange={(event) => setForm({ ...form, billingCity: event.target.value })}
                  />
                  <Input
                    label="State"
                    value={form.billingState}
                    onChange={(event) => setForm({ ...form, billingState: event.target.value })}
                  />
                  <Input
                    label="Postal Code"
                    value={form.billingPostalCode}
                    onChange={(event) => setForm({ ...form, billingPostalCode: event.target.value })}
                  />
                  <Input
                    label="Country"
                    value={form.billingCountry}
                    onChange={(event) => setForm({ ...form, billingCountry: event.target.value })}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Shipping Address</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Line 1"
                    value={form.shippingLine1}
                    onChange={(event) => setForm({ ...form, shippingLine1: event.target.value })}
                  />
                  <Input
                    label="Line 2"
                    value={form.shippingLine2}
                    onChange={(event) => setForm({ ...form, shippingLine2: event.target.value })}
                  />
                  <Input
                    label="City"
                    value={form.shippingCity}
                    onChange={(event) => setForm({ ...form, shippingCity: event.target.value })}
                  />
                  <Input
                    label="State"
                    value={form.shippingState}
                    onChange={(event) => setForm({ ...form, shippingState: event.target.value })}
                  />
                  <Input
                    label="Postal Code"
                    value={form.shippingPostalCode}
                    onChange={(event) => setForm({ ...form, shippingPostalCode: event.target.value })}
                  />
                  <Input
                    label="Country"
                    value={form.shippingCountry}
                    onChange={(event) => setForm({ ...form, shippingCountry: event.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">{editingId ? "Save Changes" : "Create Company"}</Button>
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
            <CardTitle>Companies</CardTitle>
          </CardHeader>
          <CardBody>
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by company name"
            />
            <div className="mt-6">
              <DataTable
                columns={[
                  { key: "name", label: "Name" },
                  { key: "gstin", label: "GSTIN" },
                  { key: "contact", label: "Contact" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((company) => ({
                  name: company.name,
                  gstin: company.gstin ?? "—",
                  contact: company.email ?? company.phone ?? "—",
                  actions: (
                    <Button variant="ghost" onClick={() => handleEdit(company)}>
                      Edit
                    </Button>
                  )
                }))}
                emptyLabel={loading ? "Loading companies..." : "No companies found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
