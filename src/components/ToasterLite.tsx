/**
 * 轻量 toast（技术方案：M0–M3 不启用 sonner，用最小实现顶住；M4 再评估）
 */
import { cn } from "@reasonix/ui";
import { create } from "zustand";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** 命令式入口：toast({ title, description?, variant? }) */
export function toast(t: Omit<ToastItem, "id">): void {
  useToastStore.getState().push(t);
}

export function toastError(title: string, error: unknown): void {
  toast({
    title,
    description: error instanceof Error ? error.message : String(error),
    variant: "destructive",
  });
}

export function ToasterLite() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto rounded-[var(--rx-r-m)] border px-3 py-2 text-left text-sm rx-anim-toast"
          style={{
            background: "var(--rx-bg-elev)",
            borderColor:
              t.variant === "destructive" ? "var(--rx-danger)" : "var(--rx-border)",
            color: "var(--rx-fg)",
          }}
        >
          <div className="flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: t.variant === "destructive" ? "var(--rx-danger)" : "var(--rx-ok)",
              }}
            />
            {t.title}
          </div>
          {t.description ? (
            <div className={cn("mt-0.5 pl-3.5 text-xs text-[var(--rx-fg-dim)]")}>
              {t.description}
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}
