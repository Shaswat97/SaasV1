"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/Select";
import { apiGet } from "@/lib/api-client";

const STORAGE_NAME = "activeUserName";
const STORAGE_ID = "activeUserId";

type Employee = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export function ActiveUserSelect() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<Employee[]>("/api/employees");
        const active = data.filter((employee) => employee.active);
        setEmployees(active);

        const storedId = window.localStorage.getItem(STORAGE_ID);
        const storedName = window.localStorage.getItem(STORAGE_NAME);

        if (storedId && active.some((employee) => employee.id === storedId)) {
          setSelectedId(storedId);
        } else if (active.length > 0) {
          setSelectedId(active[0].id);
          window.localStorage.setItem(STORAGE_ID, active[0].id);
          window.localStorage.setItem(STORAGE_NAME, active[0].name);
        } else if (storedName) {
          setSelectedId("");
        }
      } catch {
        // ignore, fallback to default
      }
    };

    load();
  }, []);

  const options = useMemo(() => {
    if (employees.length === 0) {
      return [{ value: "", label: "Admin" }];
    }
    return employees.map((employee) => ({
      value: employee.id,
      label: `${employee.code} · ${employee.name}`
    }));
  }, [employees]);

  return (
    <div className="rounded-2xl border border-border/60 bg-bg-subtle/80 p-4 text-xs text-text-muted">
      <Select
        label="Active User"
        value={selectedId}
        onChange={(event) => {
          const value = event.target.value;
          setSelectedId(value);
          const matched = employees.find((employee) => employee.id === value);
          if (matched) {
            window.localStorage.setItem(STORAGE_ID, matched.id);
            window.localStorage.setItem(STORAGE_NAME, matched.name);
          } else {
            window.localStorage.removeItem(STORAGE_ID);
            window.localStorage.setItem(STORAGE_NAME, "Admin");
          }
        }}
        options={options}
      />
      <p className="mt-2 text-[11px] text-text-muted">Activity logs will use this name.</p>
    </div>
  );
}
