import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export function Input({ label, hint, error, className, id, required, ...props }: InputProps) {
  // Use provided ID, or generate one from label, or use a random fallback if neither exists
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : `input-${Math.random().toString(36).substr(2, 9)}`);

  return (
    <label htmlFor={inputId} className="block space-y-2 text-sm">
      {label && (
        <span className="text-text-muted">
          {label}
          {required ? <span className="ml-1 text-warning">*</span> : null}
        </span>
      )}
      <input
        id={inputId}
        className={cn(
          "focus-ring w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-text-muted shadow-sm shadow-black/10 ring-1 ring-border/40 focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/30",
          error && "border-danger/60",
          className
        )}
        required={required}
        {...props}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {hint && !error ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}
