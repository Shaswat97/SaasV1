import { cn } from "@/lib/utils";
import type { ToastMessage } from "@/lib/use-toast";

const variants = {
  success: "border-success/40 bg-success/15 text-text",
  error: "border-danger/40 bg-danger/15 text-text",
  info: "border-accent-2/40 bg-accent-2/15 text-text"
};

export function ToastViewport({
  toasts,
  onDismiss
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-80 flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-soft",
            variants[toast.type]
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <p>{toast.message}</p>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-xs text-text-muted"
              aria-label="Dismiss"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
