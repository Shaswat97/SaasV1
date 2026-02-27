"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Download,
  Eye,
  Filter,
  KeyRound,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardBody } from "@/components/Card";
import { Input } from "@/components/Input";
import { ToastViewport } from "@/components/ToastViewport";
import { apiGet, apiSend } from "@/lib/api-client";
import { useToast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";

type Role = { id: string; name: string };

type Employee = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  pinUpdatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  roles: { role: Role }[];
};

type EmployeeForm = {
  code: string;
  name: string;
  phone: string;
  email: string;
  pin: string;
  roles: string[];
  active: boolean;
};

type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";

type AttendanceRecord = {
  id: string;
  employeeId: string;
  companyId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  notes?: string | null;
  employee?: {
    id: string;
    code: string;
    name: string;
    active: boolean;
  };
};

type AttendanceDraft = {
  status: AttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  notes: string;
  recordId?: string;
};

type ModalMode = "create" | "view" | "edit";
type ModalTab = "resume" | "work" | "contact" | "access";
type DirectoryView = "list" | "org" | "profiles";

const emptyForm: EmployeeForm = {
  code: "",
  name: "",
  phone: "",
  email: "",
  pin: "",
  roles: [],
  active: true
};

const defaultAttendanceDraft: AttendanceDraft = {
  status: "PRESENT",
  checkInTime: "",
  checkOutTime: "",
  notes: ""
};

function todayInputDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "E";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function buildCsv(employees: Employee[]) {
  const header = ["Code", "Name", "Status", "Roles", "Phone", "Email", "Created At", "PIN Updated At"];
  const rows = employees.map((employee) => [
    employee.code,
    employee.name,
    employee.active ? "Active" : "Inactive",
    employee.roles.map((entry) => entry.role.name).join("|"),
    employee.phone ?? "",
    employee.email ?? "",
    employee.createdAt ?? "",
    employee.pinUpdatedAt ?? ""
  ]);
  const all = [header, ...rows];
  return all
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`)
        .join(",")
    )
    .join("\n");
}

function StatCard({
  label,
  value,
  subtext,
  icon
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const Icon = icon;
  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-5">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-bg-subtle text-text">
          <Icon className="h-4 w-4" />
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold text-text">{value}</div>
      <p className="mt-2 text-xs text-text-muted">{subtext}</p>
    </div>
  );
}

function EmployeeStatusBadge({ active }: { active: boolean }) {
  return active ? <Badge label="Active" variant="success" /> : <Badge label="Inactive" variant="danger" />;
}

function EmployeeField({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-1", compact && "min-w-0")}>
      <p className="text-xs uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <div className="rounded-xl border border-border/60 bg-bg-subtle/60 px-3 py-2 text-sm text-text">
        {value || "—"}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSavingId, setAttendanceSavingId] = useState<string | null>(null);
  const [attendanceExpandedId, setAttendanceExpandedId] = useState<string | null>(null);
  const [attendanceDate] = useState(todayInputDate);
  const [attendanceRows, setAttendanceRows] = useState<Record<string, AttendanceDraft>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [directoryView, setDirectoryView] = useState<DirectoryView>("list");
  const [form, setForm] = useState<EmployeeForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [modalTab, setModalTab] = useState<ModalTab>("resume");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const { toasts, push, remove } = useToast();

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );

  const isEditable = modalMode === "create" || modalMode === "edit";

  async function loadData() {
    setLoading(true);
    try {
      const [employeeData, roleData] = await Promise.all([apiGet<Employee[]>("/api/employees"), apiGet<Role[]>("/api/roles")]);
      setEmployees(employeeData);
      setRoles(roleData);
      if (roleData.length > 0 && form.roles.length === 0 && !editingId) {
        setForm((current) => ({ ...current, roles: [roleData[0].name] }));
      }
    } catch (error: any) {
      push("error", error.message ?? "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  function mergeAttendanceIntoRows(records: AttendanceRecord[]) {
    const next: Record<string, AttendanceDraft> = {};
    employees.forEach((employee) => {
      next[employee.id] = { ...defaultAttendanceDraft };
    });
    records.forEach((record) => {
      next[record.employeeId] = {
        status: record.status,
        checkInTime: record.checkInTime ?? "",
        checkOutTime: record.checkOutTime ?? "",
        notes: record.notes ?? "",
        recordId: record.id
      };
    });
    setAttendanceRows(next);
  }

  async function loadAttendance(date = attendanceDate) {
    if (!employees.length) {
      setAttendanceRows({});
      return;
    }
    setAttendanceLoading(true);
    try {
      const rows = await apiGet<AttendanceRecord[]>(`/api/employee-attendance?date=${encodeURIComponent(date)}`);
      mergeAttendanceIntoRows(rows);
    } catch (error: any) {
      push("error", error.message ?? "Failed to load attendance");
    } finally {
      setAttendanceLoading(false);
    }
  }

  function updateAttendanceDraft(employeeId: string, patch: Partial<AttendanceDraft>) {
    setAttendanceRows((current) => ({
      ...current,
      [employeeId]: {
        ...(current[employeeId] ?? { ...defaultAttendanceDraft }),
        ...patch
      }
    }));
  }

  async function saveAttendance(employee: Employee) {
    const row = attendanceRows[employee.id] ?? defaultAttendanceDraft;
    setAttendanceSavingId(employee.id);
    try {
      const saved = await apiSend<AttendanceRecord>("/api/employee-attendance", "POST", {
        employeeId: employee.id,
        attendanceDate,
        status: row.status,
        checkInTime: row.checkInTime || undefined,
        checkOutTime: row.checkOutTime || undefined,
        notes: row.notes.trim() || undefined
      });
      updateAttendanceDraft(employee.id, {
        status: saved.status,
        checkInTime: saved.checkInTime ?? "",
        checkOutTime: saved.checkOutTime ?? "",
        notes: saved.notes ?? "",
        recordId: saved.id
      });
      push("success", `Attendance saved for ${employee.code}`);
    } catch (error: any) {
      push("error", error.message ?? "Failed to save attendance");
    } finally {
      setAttendanceSavingId(null);
    }
  }

  function markVisibleEmployeesPresent() {
    setAttendanceRows((current) => {
      const next = { ...current };
      filteredEmployees.forEach((employee) => {
        next[employee.id] = {
          ...(next[employee.id] ?? { ...defaultAttendanceDraft }),
          status: "PRESENT"
        };
      });
      return next;
    });
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAttendance(attendanceDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceDate, employees]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rowMenuRef.current) return;
      if (!rowMenuRef.current.contains(event.target as Node)) {
        setRowMenuId(null);
      }
    }
    if (rowMenuId) {
      document.addEventListener("mousedown", onPointerDown);
    }
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [rowMenuId]);

  function fillFormFromEmployee(employee: Employee) {
    setForm({
      code: employee.code,
      name: employee.name,
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      pin: "",
      roles: employee.roles.map((entry) => entry.role.name),
      active: employee.active
    });
  }

  function openCreateModal() {
    setEditingId(null);
    setSelectedEmployeeId(null);
    setModalMode("create");
    setModalTab("resume");
    setForm({ ...emptyForm, roles: roles[0] ? [roles[0].name] : [] });
    setModalOpen(true);
    setRowMenuId(null);
  }

  function openViewModal(employee: Employee) {
    setSelectedEmployeeId(employee.id);
    setEditingId(employee.id);
    fillFormFromEmployee(employee);
    setModalMode("view");
    setModalTab("resume");
    setModalOpen(true);
    setRowMenuId(null);
  }

  function openEditModal(employee: Employee) {
    setSelectedEmployeeId(employee.id);
    setEditingId(employee.id);
    fillFormFromEmployee(employee);
    setModalMode("edit");
    setModalTab("resume");
    setModalOpen(true);
    setRowMenuId(null);
  }

  function closeModal() {
    setModalOpen(false);
    setRowMenuId(null);
  }

  function toggleRole(roleName: string) {
    if (!isEditable) return;
    setForm((current) => {
      const exists = current.roles.includes(roleName);
      const next = exists ? current.roles.filter((role) => role !== roleName) : [...current.roles, roleName];
      return { ...current, roles: next };
    });
  }

  async function handleDelete(employee: Employee) {
    setRowMenuId(null);
    if (!window.confirm(`Delete employee ${employee.code} · ${employee.name}?`)) return;
    try {
      await apiSend(`/api/employees/${employee.id}`, "DELETE");
      push("success", "Employee deleted");
      if (selectedEmployeeId === employee.id) {
        closeModal();
      }
      setSelectedIds((prev) => prev.filter((id) => id !== employee.id));
      loadData();
    } catch (error: any) {
      push("error", error.message ?? "Failed to delete employee");
    }
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!isEditable) return;

    if (form.roles.length === 0) {
      push("error", "Select at least one role");
      setModalTab("access");
      return;
    }
    if (!editingId && !form.pin) {
      push("error", "PIN is required for new employee");
      setModalTab("access");
      return;
    }

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      pin: form.pin.trim() || undefined,
      active: form.active,
      roles: form.roles
    };

    try {
      if (editingId && modalMode !== "create") {
        await apiSend(`/api/employees/${editingId}`, "PUT", payload);
        push("success", "Employee updated");
      } else {
        await apiSend("/api/employees", "POST", payload);
        push("success", "Employee created");
      }
      await loadData();
      closeModal();
    } catch (error: any) {
      push("error", error.message ?? "Failed to save employee");
    }
  }

  function exportDirectory() {
    if (!employees.length) return;
    const csv = buildCsv(employees);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-directory.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const target = [employee.code, employee.name, employee.email ?? "", employee.phone ?? "", employee.roles.map((entry) => entry.role.name).join(" ")]
        .join(" ")
        .toLowerCase();
      if (statusFilter === "ACTIVE" && !employee.active) return false;
      if (statusFilter === "INACTIVE" && employee.active) return false;
      return target.includes(search.toLowerCase());
    });
  }, [employees, search, statusFilter]);

  const metrics = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((employee) => employee.active).length;
    const inactive = total - active;
    const adminCount = employees.filter((employee) => employee.roles.some((entry) => entry.role.name === "ADMIN")).length;
    const roleCoverage = new Set(employees.flatMap((employee) => employee.roles.map((entry) => entry.role.name))).size;
    return { total, active, inactive, adminCount, roleCoverage };
  }, [employees]);

  const attendanceSummary = useMemo(() => {
    const base = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0, UNMARKED: 0 };
    filteredEmployees.forEach((employee) => {
      const row = attendanceRows[employee.id];
      if (!row) {
        base.UNMARKED += 1;
        return;
      }
      if (row.status === "PRESENT") base.PRESENT += 1;
      else if (row.status === "ABSENT") base.ABSENT += 1;
      else if (row.status === "HALF_DAY") base.HALF_DAY += 1;
      else if (row.status === "LEAVE") base.LEAVE += 1;
      else base.UNMARKED += 1;
    });
    return base;
  }, [attendanceRows, filteredEmployees]);

  const orgGroups = useMemo(() => {
    const map = new Map<string, Employee[]>();
    filteredEmployees.forEach((employee) => {
      const primaryRole = employee.roles[0]?.role.name ?? "UNASSIGNED";
      if (!map.has(primaryRole)) map.set(primaryRole, []);
      map.get(primaryRole)!.push(employee);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEmployees]);

  const pageHeading =
    directoryView === "list"
      ? { title: "Employee List", subtitle: "Manage employee login profiles, role assignments, and operational access." }
      : directoryView === "org"
        ? { title: "Organization Chart", subtitle: "Grouped view of employees by primary role for quick access planning." }
        : { title: "Employee Profiles", subtitle: "Browse employee profiles and open details modal for updates." };

  const allFilteredSelected = filteredEmployees.length > 0 && filteredEmployees.every((employee) => selectedIds.includes(employee.id));

  function toggleSelectAllFiltered(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredEmployees.map((employee) => employee.id)])));
    } else {
      const filteredSet = new Set(filteredEmployees.map((employee) => employee.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    }
  }

  function toggleSelectOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((item) => item !== id);
    });
  }

  const modalEmployeeName = modalMode === "create" ? "New Employee" : ((selectedEmployee?.name ?? form.name) || "Employee");
  const modalSubtitle =
    modalMode === "create"
      ? "Create a new login profile and assign roles."
      : modalMode === "edit"
        ? "Update work profile, contact, and access settings."
        : "Review employee profile and operational access settings.";

  const modalTabs: Array<{ key: ModalTab; label: string }> = [
    { key: "resume", label: "Resume" },
    { key: "work", label: "Work Information" },
    { key: "contact", label: "Contact Information" },
    { key: "access", label: "Access Settings" }
  ];

  return (
    <div className="space-y-6">
      <ToastViewport toasts={toasts} onDismiss={remove} />

      <div className="rounded-2xl border border-border/60 bg-surface">
        <div className="border-b border-border/60 px-5 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              { key: "list", label: "Employee List" },
              { key: "org", label: "Organization Chart" },
              { key: "profiles", label: "Employee Profiles" }
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDirectoryView(item.key as DirectoryView)}
                className={cn(
                  "rounded-t-xl px-4 py-3 transition-colors",
                  directoryView === item.key
                    ? "border-b-2 border-accent text-accent font-medium"
                    : "text-text-muted hover:text-text"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-text">{pageHeading.title}</h1>
              <p className="mt-2 text-sm text-text-muted">{pageHeading.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" className="gap-2" disabled>
                <Download className="h-4 w-4" />
                Bulk Import
              </Button>
              <Button variant="secondary" className="gap-2" onClick={exportDirectory} disabled={!employees.length}>
                <Download className="h-4 w-4" />
                Export Directory
              </Button>
              <Button className="gap-2" onClick={openCreateModal}>
                <UserPlus className="h-4 w-4" />
                Add New Employee
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Employees" value={String(metrics.total)} subtext={`${filteredEmployees.length} visible in current filter`} icon={Users} />
            <StatCard label="Active Employees" value={String(metrics.active)} subtext={`${metrics.inactive} inactive profiles`} icon={UserCog} />
            <StatCard label="Admin Users" value={String(metrics.adminCount)} subtext="Employees with ADMIN role access" icon={ShieldCheck} />
            <StatCard label="Role Coverage" value={String(metrics.roleCoverage)} subtext="Distinct roles assigned across directory" icon={KeyRound} />
          </div>

          {directoryView === "list" ? (
            <>
              <Card className="mt-6 border-border/60">
                <CardBody className="p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-text">Attendance Register</h2>
                      <p className="mt-1 text-sm text-text-muted">
                        Mark today&apos;s attendance. Extra time and notes can be added only when needed.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full border border-border/70 bg-surface px-3 py-2 text-text">
                        Attendance date: <span className="font-medium">{formatDate(attendanceDate)}</span>
                      </span>
                      <Button variant="secondary" onClick={markVisibleEmployeesPresent} disabled={!filteredEmployees.length}>
                        Mark visible as Present
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                      Present: {attendanceSummary.PRESENT}
                    </span>
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">
                      Absent: {attendanceSummary.ABSENT}
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                      Half Day: {attendanceSummary.HALF_DAY}
                    </span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700">
                      Leave: {attendanceSummary.LEAVE}
                    </span>
                    <span className="rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-medium text-text-muted">
                      Visible: {filteredEmployees.length}
                    </span>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-2xl border border-border/60">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-border/60 bg-bg-subtle/30 text-left text-xs uppercase tracking-wider text-text-muted">
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Details</th>
                          <th className="px-4 py-3 text-right">Save</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">
                              {loading ? "Loading employees..." : "No employees available in current filter."}
                            </td>
                          </tr>
                        ) : attendanceLoading ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">
                              Loading attendance for {attendanceDate}...
                            </td>
                          </tr>
                        ) : (
                          filteredEmployees.map((employee) => {
                            const row = attendanceRows[employee.id] ?? defaultAttendanceDraft;
                            const expanded = attendanceExpandedId === employee.id;
                            return (
                              <Fragment key={`attendance-${employee.id}`}>
                                <tr className="hover:bg-bg-subtle/20">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/90 to-indigo-500/90 text-xs font-semibold text-white">
                                        {initials(employee.name)}
                                      </span>
                                      <div>
                                        <p className="text-sm font-medium text-text">{employee.name}</p>
                                        <p className="text-xs text-text-muted">{employee.code}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={row.status}
                                      onChange={(event) =>
                                        updateAttendanceDraft(employee.id, { status: event.target.value as AttendanceStatus })
                                      }
                                      className="focus-ring min-w-[140px] rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm text-text"
                                    >
                                      <option value="PRESENT">Present</option>
                                      <option value="ABSENT">Absent</option>
                                      <option value="HALF_DAY">Half Day</option>
                                      <option value="LEAVE">Leave</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => setAttendanceExpandedId(expanded ? null : employee.id)}
                                      className="focus-ring rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text"
                                    >
                                      {expanded ? "Hide details" : "Add details"}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="secondary"
                                      onClick={() => saveAttendance(employee)}
                                      disabled={attendanceSavingId === employee.id}
                                      className="min-w-[92px]"
                                    >
                                      {attendanceSavingId === employee.id ? "Saving..." : "Save"}
                                    </Button>
                                  </td>
                                </tr>
                                {expanded ? (
                                  <tr className="bg-bg-subtle/10">
                                    <td colSpan={4} className="px-4 pb-4 pt-0">
                                      <div className="mt-2 grid gap-3 rounded-2xl border border-border/60 bg-surface p-3 md:grid-cols-[160px_160px_1fr]">
                                        <label className="space-y-1">
                                          <span className="text-xs font-medium text-text-muted">Check In (optional)</span>
                                          <input
                                            type="time"
                                            value={row.checkInTime}
                                            onChange={(event) => updateAttendanceDraft(employee.id, { checkInTime: event.target.value })}
                                            className="focus-ring w-full rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm text-text"
                                          />
                                        </label>
                                        <label className="space-y-1">
                                          <span className="text-xs font-medium text-text-muted">Check Out (optional)</span>
                                          <input
                                            type="time"
                                            value={row.checkOutTime}
                                            onChange={(event) => updateAttendanceDraft(employee.id, { checkOutTime: event.target.value })}
                                            className="focus-ring w-full rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm text-text"
                                          />
                                        </label>
                                        <label className="space-y-1">
                                          <span className="text-xs font-medium text-text-muted">Notes (optional)</span>
                                          <input
                                            type="text"
                                            value={row.notes}
                                            onChange={(event) => updateAttendanceDraft(employee.id, { notes: event.target.value })}
                                            placeholder="Reason, shift remark, leave note"
                                            className="focus-ring w-full rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted"
                                          />
                                        </label>
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-text-muted">
                    Attendance is marked for today by default. Date selection was removed to avoid accidental backdated marking.
                  </p>
                </CardBody>
              </Card>

              <Card className="mt-6 overflow-hidden border-border/60">
                <CardBody className="p-0">
                  <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2 text-sm text-text">
                      <Users className="h-4 w-4 text-accent" />
                      <span>
                        Total Employee: <span className="font-semibold">{filteredEmployees.length} employees</span>
                      </span>
                      {selectedIds.length > 0 ? (
                        <span className="rounded-full bg-bg-subtle px-2 py-1 text-xs text-text-muted">
                          {selectedIds.length} selected
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                        <input
                          type="text"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search employee"
                          className="focus-ring w-full rounded-xl border border-border/70 bg-surface px-10 py-2.5 text-sm text-text placeholder:text-text-muted sm:w-72"
                        />
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface px-3 py-2">
                        <Filter className="h-4 w-4 text-text-muted" />
                        <select
                          value={statusFilter}
                          onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                          className="bg-transparent text-sm text-text outline-none"
                        >
                          <option value="ALL">All Status</option>
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-border/60 bg-bg-subtle/30 text-left text-xs uppercase tracking-wider text-text-muted">
                          <th className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={(event) => toggleSelectAllFiltered(event.target.checked)}
                              aria-label="Select all visible employees"
                            />
                          </th>
                          <th className="px-4 py-3">Employee</th>
                          <th className="px-4 py-3">Roles</th>
                          <th className="px-4 py-3">Contact</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">PIN Updated</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {filteredEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-sm text-text-muted">
                              {loading ? "Loading employees..." : "No employees found."}
                            </td>
                          </tr>
                        ) : (
                          filteredEmployees.map((employee) => {
                            const roleNames = employee.roles.map((entry) => entry.role.name);
                            const isSelected = selectedIds.includes(employee.id);
                            return (
                              <tr
                                key={employee.id}
                                className={cn("transition-colors hover:bg-bg-subtle/30", isSelected && "bg-accent/5")}
                              >
                                <td className="px-4 py-4 align-top">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(event) => toggleSelectOne(employee.id, event.target.checked)}
                                    aria-label={`Select ${employee.name}`}
                                  />
                                </td>
                                <td className="px-4 py-4">
                                  <button
                                    type="button"
                                    onClick={() => openViewModal(employee)}
                                    className="flex items-center gap-3 text-left"
                                  >
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/90 to-indigo-500/90 text-sm font-semibold text-white">
                                      {initials(employee.name)}
                                    </span>
                                    <span>
                                      <span className="block text-sm font-semibold text-text">{employee.name}</span>
                                      <span className="block text-xs text-text-muted">{employee.code}</span>
                                    </span>
                                  </button>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex flex-wrap gap-1.5">
                                    {roleNames.length ? (
                                      roleNames.map((role) => (
                                        <span
                                          key={`${employee.id}-${role}`}
                                          className={cn(
                                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border",
                                            role === "ADMIN"
                                              ? "border-amber-300 bg-amber-50 text-amber-700"
                                              : "border-border/70 bg-surface-2/60 text-text"
                                          )}
                                        >
                                          {role}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-text-muted">—</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-text-muted">
                                      <Mail className="h-3.5 w-3.5" />
                                      <span>{employee.email || "No email"}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-text-muted">
                                      <Phone className="h-3.5 w-3.5" />
                                      <span>{employee.phone || "No phone"}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <EmployeeStatusBadge active={employee.active} />
                                </td>
                                <td className="px-4 py-4 text-sm text-text-muted">{formatDate(employee.pinUpdatedAt)}</td>
                                <td className="px-4 py-4 text-sm text-text-muted">{formatDate(employee.createdAt)}</td>
                                <td className="px-4 py-4 text-right">
                                  <div className="relative inline-block" ref={rowMenuId === employee.id ? rowMenuRef : undefined}>
                                    <button
                                      type="button"
                                      className="focus-ring rounded-full p-2 text-text-muted hover:bg-bg-subtle"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setRowMenuId((current) => (current === employee.id ? null : employee.id));
                                      }}
                                      aria-label={`Open actions for ${employee.name}`}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                    {rowMenuId === employee.id ? (
                                      <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-border/70 bg-surface p-2 shadow-xl">
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-text hover:bg-bg-subtle"
                                          onClick={() => openViewModal(employee)}
                                        >
                                          <Eye className="h-4 w-4" />
                                          View Profile
                                        </button>
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-text hover:bg-bg-subtle"
                                          onClick={() => openEditModal(employee)}
                                        >
                                          <Pencil className="h-4 w-4" />
                                          Edit Details
                                        </button>
                                        <div className="my-2 border-t border-border/60" />
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger/10"
                                          onClick={() => handleDelete(employee)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Delete Employee
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}

          {directoryView === "org" ? (
            <Card className="mt-6 border-border/60">
              <CardBody className="p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search employee"
                      className="focus-ring w-full rounded-xl border border-border/70 bg-surface px-10 py-2.5 text-sm text-text placeholder:text-text-muted sm:w-72"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface px-3 py-2">
                    <Filter className="h-4 w-4 text-text-muted" />
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                      className="bg-transparent text-sm text-text outline-none"
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>

                {orgGroups.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-bg-subtle/40 p-10 text-center text-sm text-text-muted">
                    {loading ? "Loading organization chart..." : "No employees available for organization chart."}
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {orgGroups.map(([role, members]) => (
                      <div key={role} className="rounded-2xl border border-border/60 bg-surface-2/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-text">{role}</p>
                            <p className="text-xs text-text-muted">{members.length} employee{members.length === 1 ? "" : "s"}</p>
                          </div>
                          <span className="rounded-full bg-bg-subtle px-2 py-1 text-xs text-text-muted">
                            Primary group
                          </span>
                        </div>
                        <div className="space-y-2">
                          {members.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              onClick={() => openViewModal(employee)}
                              className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-surface px-3 py-2 text-left hover:bg-bg-subtle/30"
                            >
                              <span className="flex items-center gap-3">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/90 to-indigo-500/90 text-xs font-semibold text-white">
                                  {initials(employee.name)}
                                </span>
                                <span>
                                  <span className="block text-sm font-medium text-text">{employee.name}</span>
                                  <span className="block text-xs text-text-muted">{employee.code}</span>
                                </span>
                              </span>
                              <EmployeeStatusBadge active={employee.active} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ) : null}

          {directoryView === "profiles" ? (
            <Card className="mt-6 border-border/60">
              <CardBody className="p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search employee profiles"
                      className="focus-ring w-full rounded-xl border border-border/70 bg-surface px-10 py-2.5 text-sm text-text placeholder:text-text-muted sm:w-80"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface px-3 py-2">
                    <Filter className="h-4 w-4 text-text-muted" />
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                      className="bg-transparent text-sm text-text outline-none"
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>

                {filteredEmployees.length === 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-bg-subtle/40 p-10 text-center text-sm text-text-muted">
                    {loading ? "Loading employee profiles..." : "No employee profiles found."}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredEmployees.map((employee) => {
                      const primaryRole = employee.roles[0]?.role.name ?? "UNASSIGNED";
                      return (
                        <div key={employee.id} className="rounded-2xl border border-border/60 bg-surface p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-sm font-semibold text-white">
                                {initials(employee.name)}
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-text">{employee.name}</p>
                                <p className="text-xs text-text-muted">{employee.code}</p>
                              </div>
                            </div>
                            <EmployeeStatusBadge active={employee.active} />
                          </div>
                          <div className="mt-4 space-y-2 text-sm">
                            <div className="rounded-xl border border-border/50 bg-bg-subtle/30 px-3 py-2">
                              <p className="text-xs uppercase tracking-[0.16em] text-text-muted">Primary Role</p>
                              <p className="mt-1 font-medium text-text">{primaryRole}</p>
                            </div>
                            <div className="rounded-xl border border-border/50 bg-bg-subtle/30 px-3 py-2">
                              <p className="text-xs uppercase tracking-[0.16em] text-text-muted">Contact</p>
                              <p className="mt-1 text-text">{employee.email || "No email"}</p>
                              <p className="text-text-muted">{employee.phone || "No phone"}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button variant="secondary" className="flex-1" onClick={() => openViewModal(employee)}>
                              View Profile
                            </Button>
                            <Button className="flex-1" onClick={() => openEditModal(employee)}>
                              Edit Details
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={closeModal}>
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[30px] border border-border/70 bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.13),transparent_42%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_36%)]" />
            <div className="pointer-events-none absolute left-0 top-0 h-44 w-full bg-[linear-gradient(180deg,rgba(219,234,254,0.45),rgba(255,255,255,0))]" />

            <div className="relative px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-lg font-semibold text-white shadow-lg">
                    {modalMode === "create" ? <UserPlus className="h-6 w-6" /> : initials(modalEmployeeName)}
                  </span>
                  <div>
                    <p className="text-2xl font-semibold text-text">
                      {modalMode === "create" ? "Employee Details" : modalEmployeeName}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">{modalSubtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="focus-ring inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-surface text-text-muted hover:text-text"
                  aria-label="Close employee modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      label={modalMode === "create" ? "New Employee" : (form.active ? "Employee" : "Inactive Employee")}
                      variant={form.active ? "warning" : "danger"}
                      className="rounded-full px-4 py-1.5 text-sm"
                    />
                    {selectedEmployee?.roles.some((entry) => entry.role.name === "ADMIN") || form.roles.includes("ADMIN") ? (
                      <Badge label="ADMIN Access" variant="info" className="rounded-full px-4 py-1.5 text-sm" />
                    ) : null}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {modalTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setModalTab(tab.key)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors",
                          modalTab === tab.key
                            ? "border-accent bg-accent/10 text-accent font-medium"
                            : "border-border/70 text-text-muted hover:text-text"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-white/70 p-4">
                  <div className="mx-auto flex h-36 w-full max-w-[220px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-slate-100">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-2xl font-semibold text-white shadow-lg">
                      {modalMode === "create" ? "E" : initials(modalEmployeeName)}
                    </div>
                  </div>
                  <p className="mt-4 text-center text-sm font-medium text-text">{form.code || "Employee Code"}</p>
                  <p className="mt-1 text-center text-xs text-text-muted">
                    {form.roles.length ? form.roles.join(", ") : "Assign roles in Access Settings"}
                  </p>
                </div>
              </div>

              <form className="mt-7 space-y-6" onSubmit={handleSubmit}>
                {modalTab === "resume" ? (
                  <div className="rounded-2xl border border-border/60 bg-surface p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Resume</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {isEditable ? (
                        <>
                          <Input
                            label="Employee Code"
                            value={form.code}
                            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                            required
                          />
                          <Input
                            label="Employee Name"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            required
                          />
                        </>
                      ) : (
                        <>
                          <EmployeeField label="Employee Code" value={selectedEmployee?.code ?? "—"} />
                          <EmployeeField label="Employee Name" value={selectedEmployee?.name ?? "—"} />
                        </>
                      )}
                      <EmployeeField
                        label="Status"
                        value={selectedEmployee ? (selectedEmployee.active ? "Active" : "Inactive") : (form.active ? "Active" : "Inactive")}
                      />
                      <EmployeeField
                        label="Roles"
                        value={(selectedEmployee?.roles.map((entry) => entry.role.name).join(", ") || form.roles.join(", ")) || "—"}
                      />
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <EmployeeField label="Profile Created" value={formatDateTime(selectedEmployee?.createdAt)} />
                      <EmployeeField label="PIN Last Updated" value={formatDateTime(selectedEmployee?.pinUpdatedAt)} />
                    </div>
                  </div>
                ) : null}

                {modalTab === "work" ? (
                  <div className="rounded-2xl border border-border/60 bg-surface p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Work Information</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <EmployeeField
                        label="Primary Role"
                        value={(form.roles[0] || selectedEmployee?.roles[0]?.role.name || "Unassigned")}
                      />
                      <EmployeeField
                        label="Access Scope"
                        value={form.roles.includes("ADMIN") || selectedEmployee?.roles.some((entry) => entry.role.name === "ADMIN")
                          ? "Full Admin Access"
                          : "Role-based Access"}
                      />
                    </div>
                    <div className="mt-4 rounded-2xl border border-border/60 bg-bg-subtle/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Assigned Roles</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(form.roles.length ? form.roles : selectedEmployee?.roles.map((entry) => entry.role.name) ?? []).map((role) => (
                          <span key={`work-role-${role}`} className="rounded-full border border-border/60 bg-surface px-3 py-1 text-xs font-medium text-text">
                            {role}
                          </span>
                        ))}
                        {!form.roles.length && !selectedEmployee?.roles.length ? (
                          <span className="text-xs text-text-muted">No roles assigned.</span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs text-text-muted">
                        Roles control access to sales, purchase, production, inventory, reports, and settings modules.
                      </p>
                    </div>
                  </div>
                ) : null}

                {modalTab === "contact" ? (
                  <div className="rounded-2xl border border-border/60 bg-surface p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Contact Information</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {isEditable ? (
                        <>
                          <Input
                            label="Email"
                            type="email"
                            value={form.email}
                            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                            placeholder="employee@company.com"
                          />
                          <Input
                            label="Phone"
                            value={form.phone}
                            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                            placeholder="+91..."
                          />
                        </>
                      ) : (
                        <>
                          <EmployeeField label="Email" value={selectedEmployee?.email ?? "—"} />
                          <EmployeeField label="Phone" value={selectedEmployee?.phone ?? "—"} />
                        </>
                      )}
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <EmployeeField label="Login Code" value={(selectedEmployee?.code ?? form.code) || "—"} />
                      <EmployeeField label="Directory Visibility" value={selectedEmployee?.active ?? form.active ? "Visible (Active)" : "Hidden from login"} />
                    </div>
                  </div>
                ) : null}

                {modalTab === "access" ? (
                  <div className="rounded-2xl border border-border/60 bg-surface p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">HR / Access Settings</p>

                    <div className="mt-4 rounded-2xl border border-border/60 bg-bg-subtle/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Role Permissions</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {roles.map((role) => (
                          <label
                            key={role.id}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                              isEditable ? "cursor-pointer border-border/60 hover:bg-surface-2/40" : "border-border/40 opacity-80"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={form.roles.includes(role.name)}
                              onChange={() => toggleRole(role.name)}
                              disabled={!isEditable}
                            />
                            <span>{role.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {isEditable ? (
                        <>
                          <Input
                            label={editingId ? "Reset PIN (optional)" : "PIN"}
                            type="password"
                            inputMode="numeric"
                            maxLength={8}
                            value={form.pin}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, pin: event.target.value.replace(/\D/g, "") }))
                            }
                            placeholder="4 to 8 digits"
                            required={modalMode === "create"}
                            hint={editingId ? "Leave blank to keep existing PIN." : "Employee login PIN (4 to 8 digits)."}
                          />
                          <label className="flex items-center gap-3 rounded-2xl border border-border/60 bg-bg-subtle/40 px-4 py-3 text-sm text-text">
                            <input
                              type="checkbox"
                              checked={form.active}
                              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                            />
                            <span>Employee account is active and allowed to log in</span>
                          </label>
                        </>
                      ) : (
                        <>
                          <EmployeeField label="PIN Management" value="PIN hidden. Switch to Edit Information to reset PIN." />
                          <EmployeeField label="Account State" value={selectedEmployee?.active ? "Active (Login Enabled)" : "Inactive (Login Blocked)"} />
                        </>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-3">
                  {modalMode === "view" ? (
                    <>
                      <Button variant="secondary" onClick={closeModal}>
                        Close
                      </Button>
                      {selectedEmployee ? (
                        <Button
                          type="button"
                          onClick={() => {
                            fillFormFromEmployee(selectedEmployee);
                            setEditingId(selectedEmployee.id);
                            setModalMode("edit");
                          }}
                        >
                          Edit Information
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          if (selectedEmployee && modalMode === "edit") {
                            fillFormFromEmployee(selectedEmployee);
                            setModalMode("view");
                          } else {
                            closeModal();
                          }
                        }}
                      >
                        {selectedEmployee && modalMode === "edit" ? "Cancel Edit" : "Cancel"}
                      </Button>
                      <Button type="submit">{modalMode === "create" ? "Create Employee" : "Save Changes"}</Button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
