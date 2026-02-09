"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  className?: string;
  scrollRef?: React.RefObject<HTMLDivElement>;
  autoScrollTop?: boolean;
};

export function Modal({
  open,
  title,
  children,
  onClose,
  actions,
  className,
  scrollRef,
  autoScrollTop = true
}: ModalProps) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const panelRef = scrollRef ?? localRef;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (autoScrollTop) {
      panelRef.current?.scrollTo({ top: 0 });
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, autoScrollTop, scrollRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        className={cn("panel-strong w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6", className)}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button className="focus-ring rounded-full px-3 py-1 text-sm text-text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-6 text-sm text-text-muted">{children}</div>
        {actions ? <div className="mt-8 flex justify-end gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
