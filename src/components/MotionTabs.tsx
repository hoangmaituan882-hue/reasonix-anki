import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { cn } from "@reasonix/ui";

export type MotionTabsVariant = "pill" | "underline" | "segment";

interface MotionTabsContextValue {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
  variant: MotionTabsVariant;
}

const MotionTabsContext = createContext<MotionTabsContextValue | null>(null);

function useMotionTabs() {
  const ctx = useContext(MotionTabsContext);
  if (!ctx) throw new Error("MotionTabs.* components must be used within <MotionTabs>");
  return ctx;
}

const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 24,
  mass: 1,
};

export interface MotionTabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: MotionTabsVariant;
  children: ReactNode;
  className?: string;
}

export function MotionTabs({
  defaultValue,
  value,
  onValueChange,
  variant = "pill",
  children,
  className,
}: MotionTabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const baseLayoutId = useId();
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange],
  );

  const contextValue = useMemo(
    () => ({ value: current, setValue, layoutId: baseLayoutId, variant }),
    [current, baseLayoutId, setValue, variant],
  );

  return (
    <MotionTabsContext.Provider value={contextValue}>
      <div className={className}>
        {children}
      </div>
    </MotionTabsContext.Provider>
  );
}

const listClasses: Record<MotionTabsVariant, string> = {
  pill: "inline-flex items-center gap-1 rounded-full bg-[var(--rx-bg-soft)] p-1 border border-[var(--rx-border-soft)]",
  underline: "inline-flex items-center gap-2 border-b border-[var(--rx-border-soft)]",
  segment: "inline-flex items-center gap-1 rounded-[var(--rx-r-m)] bg-[var(--rx-bg-soft)] p-1 border border-[var(--rx-border-soft)]",
};

export function MotionTabsList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { variant } = useMotionTabs();
  return (
    <div role="tablist" className={cn(listClasses[variant], className)}>
      {children}
    </div>
  );
}

export interface MotionTabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
  indicatorClassName?: string;
  disabled?: boolean;
}

export function MotionTabsTrigger({
  value,
  children,
  className,
  indicatorClassName,
  disabled = false,
}: MotionTabsTriggerProps) {
  const { value: current, setValue, layoutId, variant } = useMotionTabs();
  const active = current === value;

  if (variant === "underline") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        disabled={disabled}
        onClick={() => setValue(value)}
        className={cn(
          "relative isolate px-3 pb-2 pt-1 -mb-px text-body-sm font-medium transition-colors inline-flex items-center justify-center cursor-pointer select-none",
          active ? "text-[var(--rx-fg)] font-bold" : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]",
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
      >
        <span className="relative z-10">{children}</span>
        {active ? (
          <motion.span
            layoutId={`${layoutId}-underline`}
            transition={springTransition}
            className={cn(
              "absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--rx-accent)] rounded-full",
              indicatorClassName,
            )}
          />
        ) : null}
      </button>
    );
  }

  const isPill = variant === "pill";

  return (
    <div className="relative">
      {active ? (
        <motion.span
          layoutId={`${layoutId}-indicator`}
          transition={springTransition}
          className={cn(
            "absolute inset-0 shadow-2xs",
            isPill
              ? "rounded-full bg-[var(--rx-accent)] text-[var(--rx-accent-fg)]"
              : "rounded-[calc(var(--rx-r-m)-2px)] bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)]",
            indicatorClassName,
          )}
        />
      ) : null}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        disabled={disabled}
        onClick={() => setValue(value)}
        className={cn(
          "relative z-10 inline-flex items-center justify-center whitespace-nowrap bg-transparent px-3 py-1.5 text-body-sm font-medium outline-none transition-colors cursor-pointer select-none",
          isPill ? "rounded-full" : "rounded-[calc(var(--rx-r-m)-2px)]",
          active
            ? isPill
              ? "text-[var(--rx-accent-fg)] font-bold"
              : "text-[var(--rx-fg)] font-bold"
            : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]",
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
      >
        {children}
      </button>
    </div>
  );
}

export function MotionTabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const { value: current } = useMotionTabs();
  const shouldReduceMotion = useReducedMotion();
  const active = current === value;

  if (!active) {
    return (
      <div hidden className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("mt-3", className)}
    >
      {children}
    </motion.div>
  );
}
