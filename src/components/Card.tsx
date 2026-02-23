import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type CardProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "strong";
};

export function Card({ children, className, variant = "default" }: CardProps) {
  return (
    <div className={cn(variant === "strong" ? "panel-strong" : "panel", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 pt-6", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-lg font-semibold", className)}>{children}</h3>;
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-2 text-sm text-text-muted", className)}>{children}</p>;
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 pb-6", className)}>{children}</div>;
}
