import type { ReactNode } from "react";

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-text-muted">RAG Industries</p>
        <h1 className="mt-3 text-3xl font-semibold text-balance">{title}</h1>
        {subtitle ? <p className="mt-3 text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
