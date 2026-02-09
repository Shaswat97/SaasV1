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

type Customer = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
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
  active: boolean;
};

const emptyForm = {
  code: "",
  name: "",
  phone: "",
  email: "",
  gstin: "",
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
  shippingCountry: "",
  active: true
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toasts, push, remove } = useToast();

  async function loadCustomers() {
    setLoading(true);
    try {
      const data = await apiGet<Customer[]>("/api/customers");
      setCustomers(data);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEdit(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      code: customer.code,
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      gstin: customer.gstin ?? "",
      billingLine1: customer.billingLine1 ?? "",
      billingLine2: customer.billingLine2 ?? "",
      billingCity: customer.billingCity ?? "",
      billingState: customer.billingState ?? "",
      billingPostalCode: customer.billingPostalCode ?? "",
      billingCountry: customer.billingCountry ?? "",
      shippingLine1: customer.shippingLine1 ?? "",
      shippingLine2: customer.shippingLine2 ?? "",
      shippingCity: customer.shippingCity ?? "",
      shippingState: customer.shippingState ?? "",
      shippingPostalCode: customer.shippingPostalCode ?? "",
      shippingCountry: customer.shippingCountry ?? "",
      active: customer.active
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      code: form.code,
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      gstin: form.gstin || undefined,
      active: form.active,
      billingAddress: buildAddress(form, "billing"),
      shippingAddress: buildAddress(form, "shipping")
    };

    try {
      if (editingId) {
        await apiSend(`/api/customers/${editingId}`, "PUT", payload);
        push("success", "Customer updated");
      } else {
        await apiSend("/api/customers", "POST", payload);
        push("success", "Customer created");
      }
      resetForm();
      loadCustomers();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save customer");
    }
  }

  const filtered = customers.filter((customer) => {
    const target = `${customer.code} ${customer.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Customers"
        subtitle="Accounts that receive finished goods and service commitments."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Customer" : "Add Customer"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Customer Code"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  required
                />
                <Input
                  label="Customer Name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
                <Input
                  label="Email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  type="email"
                />
              </div>
              <Input
                label="GSTIN"
                value={form.gstin}
                onChange={(event) => setForm({ ...form, gstin: event.target.value })}
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

              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                Active
              </label>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">{editingId ? "Save Changes" : "Create Customer"}</Button>
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
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardBody>
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by code or name"
            />
            <div className="mt-6">
              <DataTable
                columns={[
                  { key: "code", label: "Code" },
                  { key: "name", label: "Customer" },
                  { key: "contact", label: "Contact" },
                  { key: "status", label: "Status" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((customer) => ({
                  code: customer.code,
                  name: customer.name,
                  contact: customer.email ?? customer.phone ?? "—",
                  status: customer.active ? "Active" : "Inactive",
                  actions: (
                    <Button variant="ghost" onClick={() => handleEdit(customer)}>
                      Edit
                    </Button>
                  )
                }))}
                emptyLabel={loading ? "Loading customers..." : "No customers found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
