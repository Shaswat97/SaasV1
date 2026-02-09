import { cn } from "@/lib/utils";

const variants = {
  neutral: "bg-surface-2/80 text-text",
  info: "bg-accent-2/20 text-text border border-accent-2/40",
  success: "bg-success/20 text-text border border-success/40",
  warning: "bg-warning/20 text-text border border-warning/50",
  danger: "bg-danger/20 text-text border border-danger/40"
};

export type BadgeProps = {
  label: string;
  variant?: keyof typeof variants;
  className?: string;
};

export function Badge({ label, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide",
        variants[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
