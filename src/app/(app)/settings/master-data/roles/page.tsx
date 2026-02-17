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

type Role = {
  id: string;
  name: string;
  permissions: string[];
};

type PermissionGroup = {
  group: string;
  permissions: Array<{ key: string; label: string }>;
};

type RolesResponse = {
  roles: Role[];
  permissionCatalog: PermissionGroup[];
};

const emptyForm = {
  name: "",
  permissions: [] as string[]
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toasts, push, remove } = useToast();

  async function loadRoles() {
    setLoading(true);
    try {
      const data = await apiGet<RolesResponse>("/api/roles?includeCatalog=true");
      setRoles(data.roles);
      setCatalog(data.permissionCatalog);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePermission(key: string) {
    setForm((current) => {
      const exists = current.permissions.includes(key);
      const next = exists
        ? current.permissions.filter((permission) => permission !== key)
        : [...current.permissions, key];
      return { ...current, permissions: next };
    });
  }

  function handleEdit(role: Role) {
    setEditingId(role.id);
    setForm({
      name: role.name,
      permissions: role.permissions
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.permissions.length === 0) {
      push("error", "Select at least one permission");
      return;
    }

    const payload = {
      name: form.name.trim().toUpperCase(),
      permissions: form.permissions
    };

    try {
      if (editingId) {
        await apiSend(`/api/roles/${editingId}`, "PUT", payload);
        push("success", "Role updated");
      } else {
        await apiSend("/api/roles", "POST", payload);
        push("success", "Role created");
      }
      resetForm();
      loadRoles();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save role");
    }
  }

  async function handleDelete(roleId: string) {
    try {
      await apiSend(`/api/roles/${roleId}`, "DELETE");
      push("success", "Role deleted");
      if (editingId === roleId) {
        resetForm();
      }
      loadRoles();
    } catch (error: any) {
      push("error", error.message ?? "Failed to delete role");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toasts={toasts} onDismiss={remove} />
      <SectionHeader
        title="Roles"
        subtitle="Admin can create role templates and choose exactly which processes each role can access."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Role" : "Add Role"}</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Role Name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value.toUpperCase() }))}
                placeholder="e.g. ORDER_MANAGER"
                required
              />
              <div className="max-h-[420px] space-y-4 overflow-y-auto rounded-2xl border border-border/60 p-4">
                {catalog.map((group) => (
                  <div key={group.group}>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{group.group}</p>
                    <div className="mt-2 space-y-2">
                      {group.permissions.map((permission) => (
                        <label key={permission.key} className="flex items-start gap-2 text-sm text-text-muted">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(permission.key)}
                            onChange={() => togglePermission(permission.key)}
                          />
                          <span>{permission.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit">{editingId ? "Save Role" : "Create Role"}</Button>
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
            <CardTitle>Existing Roles</CardTitle>
          </CardHeader>
          <CardBody>
            <DataTable
              columns={[
                { key: "name", label: "Role" },
                { key: "permissions", label: "Permissions" },
                { key: "actions", label: "" }
              ]}
              rows={roles.map((role) => ({
                name: role.name,
                permissions: `${role.permissions.length} selected`,
                actions: (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => handleEdit(role)}>
                      Edit
                    </Button>
                    {role.name !== "ADMIN" ? (
                      <Button variant="ghost" onClick={() => handleDelete(role.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                )
              }))}
              emptyLabel={loading ? "Loading roles..." : "No roles found."}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
