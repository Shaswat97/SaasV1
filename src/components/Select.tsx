import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
  required?: boolean;
};

export function Select({
  label,
  options,
  hint,
  error,
  className,
  id,
  required,
  ...props
}: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label htmlFor={selectId} className="block space-y-2 text-sm">
      <span className="text-text-muted">
        {label}
        {required ? <span className="ml-1 text-warning">*</span> : null}
      </span>
      <select
        id={selectId}
        className={cn(
          "focus-ring w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text shadow-sm shadow-black/10 ring-1 ring-border/40 focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/30",
          error && "border-danger/60",
          className
        )}
        required={required}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {hint && !error ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}
