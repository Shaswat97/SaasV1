import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-accent text-white hover:bg-accent/90",
  secondary: "bg-surface-2/80 text-text hover:bg-surface-2",
  ghost: "bg-transparent text-text hover:bg-bg-subtle"
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={cn(
        "focus-ring inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium transition",
        variants[variant],
        className
      )}
    />
  );
}
