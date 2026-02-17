"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export function LoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Login failed");
      }
      if (payload?.data?.employeeName) {
        window.localStorage.setItem("activeUserName", payload.data.employeeName);
      }
      if (payload?.data?.employeeId) {
        window.localStorage.setItem("activeUserId", payload.data.employeeId);
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Employee Code" value={code} onChange={(event) => setCode(event.target.value)} required />
      <Input
        label="PIN"
        type="password"
        inputMode="numeric"
        maxLength={8}
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
        required
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
