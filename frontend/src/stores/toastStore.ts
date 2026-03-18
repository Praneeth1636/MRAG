import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  variant: "success" | "error" | "info";
}

interface ToastState {
  toasts: Toast[];
  add: (message: string, variant?: Toast["variant"]) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, variant = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(
      () =>
        set((s) => ({
          toasts: s.toasts.filter((t) => t.id !== id),
        })),
      4000,
    );
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

