import { useCallback, useState } from "react";

export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = createId();
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => remove(id), 4000);
    return id;
  }, [remove]);

  return { toasts, push, remove };
}
