"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { SectionHeader } from "@/components/SectionHeader";
import { Select } from "@/components/Select";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";

type Role = { id: string; name: "ADMIN" };

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [loading, setLoading] = useState(false);
  const { toasts, push, remove } = useToast();

  async function loadRoles() {
    setLoading(true);
    try {
      const data = await apiGet<Role[]>("/api/roles");
      setRoles(data);
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      await apiSend("/api/roles", "POST", { name: selectedRole });
      push("success", "Role created");
      loadRoles();
    } catch (error: any) {
      push("error", error.message ?? "Failed to create role");
    }
  }

  async function handleDelete(roleId: string) {
    try {
      await apiSend(`/api/roles/${roleId}`, "DELETE");
      push("success", "Role deleted");
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
        subtitle="Manage the single admin role for the prototype."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add Role</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Select
                label="Role Name"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                options={[{ value: "ADMIN", label: "ADMIN" }]}
                required
              />
              <Button type="submit">Create Role</Button>
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
                { key: "actions", label: "" }
              ]}
              rows={roles.map((role) => ({
                name: role.name,
                actions: (
                  <Button variant="ghost" onClick={() => handleDelete(role.id)}>
                    Delete
                  </Button>
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
