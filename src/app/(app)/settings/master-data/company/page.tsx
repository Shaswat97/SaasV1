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
  pan?: string | null;
  cin?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  printHeaderLine1?: string | null;
  printHeaderLine2?: string | null;
  printTerms?: string | null;
  printFooterNote?: string | null;
  printPreparedByLabel?: string | null;
  printAuthorizedByLabel?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankUpiId?: string | null;
  printShowTaxBreakup?: boolean | null;
  printShowCompanyGstin?: boolean | null;
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
  pan: "",
  cin: "",
  phone: "",
  email: "",
  website: "",
  printHeaderLine1: "",
  printHeaderLine2: "",
  printTerms: "",
  printFooterNote: "",
  printPreparedByLabel: "",
  printAuthorizedByLabel: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankName: "",
  bankBranch: "",
  bankUpiId: "",
  printShowTaxBreakup: true,
  printShowCompanyGstin: true,
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
  const read = (suffix: "Line1" | "Line2" | "City" | "State" | "PostalCode" | "Country") =>
    (fields[`${prefix}${suffix}` as keyof typeof emptyForm] as string) || undefined;
  return {
    line1: read("Line1"),
    line2: read("Line2"),
    city: read("City"),
    state: read("State"),
    postalCode: read("PostalCode"),
    country: read("Country")
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
      pan: company.pan ?? "",
      cin: company.cin ?? "",
      phone: company.phone ?? "",
      email: company.email ?? "",
      website: company.website ?? "",
      printHeaderLine1: company.printHeaderLine1 ?? "",
      printHeaderLine2: company.printHeaderLine2 ?? "",
      printTerms: company.printTerms ?? "",
      printFooterNote: company.printFooterNote ?? "",
      printPreparedByLabel: company.printPreparedByLabel ?? "",
      printAuthorizedByLabel: company.printAuthorizedByLabel ?? "",
      bankAccountName: company.bankAccountName ?? "",
      bankAccountNumber: company.bankAccountNumber ?? "",
      bankIfsc: company.bankIfsc ?? "",
      bankName: company.bankName ?? "",
      bankBranch: company.bankBranch ?? "",
      bankUpiId: company.bankUpiId ?? "",
      printShowTaxBreakup: company.printShowTaxBreakup ?? true,
      printShowCompanyGstin: company.printShowCompanyGstin ?? true,
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
      pan: form.pan || undefined,
      cin: form.cin || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      printHeaderLine1: form.printHeaderLine1 || undefined,
      printHeaderLine2: form.printHeaderLine2 || undefined,
      printTerms: form.printTerms || undefined,
      printFooterNote: form.printFooterNote || undefined,
      printPreparedByLabel: form.printPreparedByLabel || undefined,
      printAuthorizedByLabel: form.printAuthorizedByLabel || undefined,
      bankAccountName: form.bankAccountName || undefined,
      bankAccountNumber: form.bankAccountNumber || undefined,
      bankIfsc: form.bankIfsc || undefined,
      bankName: form.bankName || undefined,
      bankBranch: form.bankBranch || undefined,
      bankUpiId: form.bankUpiId || undefined,
      printShowTaxBreakup: form.printShowTaxBreakup,
      printShowCompanyGstin: form.printShowCompanyGstin,
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
                  label="PAN"
                  value={form.pan}
                  onChange={(event) => setForm({ ...form, pan: event.target.value })}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="CIN"
                  value={form.cin}
                  onChange={(event) => setForm({ ...form, cin: event.target.value })}
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
              <Input
                label="Website"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                placeholder="https://example.com"
              />

              <div className="rounded-2xl border border-border/60 bg-bg-subtle/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Print Profile</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Header Line 1"
                    value={form.printHeaderLine1}
                    onChange={(event) => setForm({ ...form, printHeaderLine1: event.target.value })}
                    placeholder="Company legal name"
                  />
                  <Input
                    label="Header Line 2"
                    value={form.printHeaderLine2}
                    onChange={(event) => setForm({ ...form, printHeaderLine2: event.target.value })}
                    placeholder="Tagline / address / branch"
                  />
                  <Input
                    label="Prepared By Label"
                    value={form.printPreparedByLabel}
                    onChange={(event) => setForm({ ...form, printPreparedByLabel: event.target.value })}
                    placeholder="Prepared By"
                  />
                  <Input
                    label="Authorized Signatory Label"
                    value={form.printAuthorizedByLabel}
                    onChange={(event) => setForm({ ...form, printAuthorizedByLabel: event.target.value })}
                    placeholder="Authorized Signatory"
                  />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Input
                    label="Bank Name"
                    value={form.bankName}
                    onChange={(event) => setForm({ ...form, bankName: event.target.value })}
                  />
                  <Input
                    label="Bank Branch"
                    value={form.bankBranch}
                    onChange={(event) => setForm({ ...form, bankBranch: event.target.value })}
                  />
                  <Input
                    label="Account Name"
                    value={form.bankAccountName}
                    onChange={(event) => setForm({ ...form, bankAccountName: event.target.value })}
                  />
                  <Input
                    label="Account Number"
                    value={form.bankAccountNumber}
                    onChange={(event) => setForm({ ...form, bankAccountNumber: event.target.value })}
                  />
                  <Input
                    label="IFSC"
                    value={form.bankIfsc}
                    onChange={(event) => setForm({ ...form, bankIfsc: event.target.value })}
                  />
                  <Input
                    label="UPI ID"
                    value={form.bankUpiId}
                    onChange={(event) => setForm({ ...form, bankUpiId: event.target.value })}
                  />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={form.printShowCompanyGstin}
                      onChange={(event) => setForm({ ...form, printShowCompanyGstin: event.target.checked })}
                    />
                    Show GSTIN on documents
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={form.printShowTaxBreakup}
                      onChange={(event) => setForm({ ...form, printShowTaxBreakup: event.target.checked })}
                    />
                    Show tax breakup table
                  </label>
                </div>

                <div className="mt-4 grid gap-4">
                  <label className="text-sm font-medium text-text">
                    Terms & Conditions
                    <textarea
                      value={form.printTerms}
                      onChange={(event) => setForm({ ...form, printTerms: event.target.value })}
                      className="focus-ring mt-2 min-h-[96px] w-full rounded-2xl border border-border/70 bg-surface px-4 py-3 text-sm text-text"
                      placeholder="Payment terms, warranty, jurisdiction, etc."
                    />
                  </label>
                  <label className="text-sm font-medium text-text">
                    Footer Note
                    <textarea
                      value={form.printFooterNote}
                      onChange={(event) => setForm({ ...form, printFooterNote: event.target.value })}
                      className="focus-ring mt-2 min-h-[72px] w-full rounded-2xl border border-border/70 bg-surface px-4 py-3 text-sm text-text"
                      placeholder="Computer-generated note, support contact, etc."
                    />
                  </label>
                </div>
              </div>

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
                  { key: "pan", label: "PAN" },
                  { key: "contact", label: "Contact" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((company) => ({
                  name: company.name,
                  gstin: company.gstin ?? "—",
                  pan: company.pan ?? "—",
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
