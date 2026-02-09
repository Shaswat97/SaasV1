import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(message: string, status = 400, errors?: Array<{ field?: string; message: string }>) {
  return NextResponse.json({ ok: false, message, errors }, { status });
}

export function zodError(error: ZodError) {
  const errors = error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message
  }));
  return jsonError("Validation failed", 400, errors);
}
