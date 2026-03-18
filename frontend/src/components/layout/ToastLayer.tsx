import { useToastStore } from "@/stores/toastStore";
import { cn } from "@/lib/utils";

const variantColors: Record<
  "success" | "error" | "info",
  { bar: string; base: string }
> = {
  success: {
    bar: "bg-emerald-400",
    base: "border-emerald-500/40",
  },
  error: {
    bar: "bg-rose-400",
    base: "border-rose-500/40",
  },
  info: {
    bar: "bg-cyan-400",
    base: "border-cyan-500/40",
  },
};

export function ToastLayer() {
  const { toasts, dismiss } = useToastStore();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const colors = variantColors[toast.variant];
        return (
          <div
            key={toast.id}
            className={cn(
              "anim-slide pointer-events-auto flex overflow-hidden rounded-lg border bg-surface-2/95 shadow-lifted backdrop-blur",
              colors.base,
            )}
          >
            <div className={cn("w-1.5", colors.bar)} />
            <div className="flex flex-1 items-start justify-between gap-3 px-3 py-2.5">
              <p className="text-[13px] font-sans text-[var(--text-primary)]">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="ml-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

