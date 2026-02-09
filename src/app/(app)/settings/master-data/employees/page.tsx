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

type Role = { id: string; name: "ADMIN" };

type Employee = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  roles: { role: Role }[];
};

const emptyForm = {
  code: "",
  name: "",
  phone: "",
  email: "",
  role: "ADMIN",
  active: true
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toasts, push, remove } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [employeeData, roleData] = await Promise.all([
        apiGet<Employee[]>("/api/employees"),
        apiGet<Role[]>("/api/roles")
      ]);
      setEmployees(employeeData);
      setRoles(roleData);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleOptions = useMemo(() => {
    if (roles.length === 0) {
      return [{ value: "ADMIN", label: "Admin" }];
    }
    return roles.map((role) => ({ value: role.name, label: role.name }));
  }, [roles]);

  function handleEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      code: employee.code,
      name: employee.name,
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      role: employee.roles[0]?.role.name ?? "ADMIN",
      active: employee.active
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
      active: form.active,
      roles: [form.role]
    };

    try {
      if (editingId) {
        await apiSend(`/api/employees/${editingId}`, "PUT", payload);
        push("success", "Employee updated");
      } else {
        await apiSend("/api/employees", "POST", payload);
        push("success", "Employee created");
      }
      resetForm();
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save employee");
    }
  }

  const filtered = employees.filter((employee) => {
    const target = `${employee.code} ${employee.name}`.toLowerCase();
    return target.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Employees"
        subtitle="Maintain the employee directory and access role assignments."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Employee" : "Add Employee"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 lg:grid-cols-2">
                <Input
                  label="Employee Code"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  required
                />
                <Input
                  label="Employee Name"
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
              <Select
                label="Role"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                options={roleOptions}
                required
              />
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                Active
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">{editingId ? "Save Changes" : "Create Employee"}</Button>
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
            <CardTitle>Employees</CardTitle>
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
                  { key: "name", label: "Name" },
                  { key: "role", label: "Role" },
                  { key: "status", label: "Status" },
                  { key: "actions", label: "" }
                ]}
                rows={filtered.map((employee) => ({
                  code: employee.code,
                  name: employee.name,
                  role: employee.roles.map((role) => role.role.name).join(", ") || "—",
                  status: employee.active ? "Active" : "Inactive",
                  actions: (
                    <Button variant="ghost" onClick={() => handleEdit(employee)}>
                      Edit
                    </Button>
                  )
                }))}
                emptyLabel={loading ? "Loading employees..." : "No employees found."}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
