"use client";

import { Check } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PANEL } from "../lib/ease";
import { cn } from "@reasonix/ui";

type OpenModality = "pointer" | "keyboard" | "touch";
type MenuPoint = { x: number; y: number };

const VIEWPORT_PADDING = 8;
const LONG_PRESS_DELAY = 520;
const LONG_PRESS_TOLERANCE = 10;
const MORPH_DURATION = 0.26;

type TriggerElementProps = React.HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLElement>;
};

interface ContextMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openAt: (point: MenuPoint, modality: OpenModality) => void;
  point: MenuPoint;
  modality: OpenModality;
  invocation: number;
  menuId: string;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  reduce: boolean;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

function useContextMenuContext(component: string) {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error(`${component} must be used within <ContextMenu>`);
  }
  return context;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

function getEnabledItems(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-context-menu-item="true"]:not([data-disabled="true"])',
    ),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function collapsedClip(
  origin: MenuPoint,
  size: { width: number; height: number },
) {
  const half = 8;
  const top = clamp(origin.y - half, 0, size.height);
  const right = clamp(size.width - origin.x - half, 0, size.width);
  const bottom = clamp(size.height - origin.y - half, 0, size.height);
  const left = clamp(origin.x - half, 0, size.width);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 10px)`;
}

export interface ContextMenuProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function ContextMenu({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
}: ContextMenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [point, setPoint] = useState<MenuPoint>({ x: 0, y: 0 });
  const [modality, setModality] = useState<OpenModality>("pointer");
  const [invocation, setInvocation] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const reduce = useReducedMotion() ?? false;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
      if (!next) setActiveId(null);
    },
    [controlled, onOpenChange],
  );

  const openAt = useCallback(
    (nextPoint: MenuPoint, nextModality: OpenModality) => {
      setPoint(nextPoint);
      setModality(nextModality);
      setInvocation((current) => current + 1);
      setActiveId(null);
      setOpen(true);
    },
    [setOpen],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!contentRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onWindowChange = () => setOpen(false);

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange);
    };
  }, [open, setOpen]);

  const value = useMemo<ContextMenuContextValue>(
    () => ({
      open,
      setOpen,
      openAt,
      point,
      modality,
      invocation,
      menuId,
      triggerRef,
      contentRef,
      activeId,
      setActiveId,
      reduce,
    }),
    [
      open,
      setOpen,
      openAt,
      point,
      modality,
      invocation,
      menuId,
      activeId,
      reduce,
    ],
  );

  return (
    <ContextMenuContext.Provider value={value}>
      {className ? <div className={cn("contents", className)}>{children}</div> : children}
    </ContextMenuContext.Provider>
  );
}

export interface ContextMenuTriggerProps {
  children: ReactElement<TriggerElementProps>;
  disabled?: boolean;
  className?: string;
}

export function ContextMenuTrigger({
  children,
  disabled = false,
  className,
}: ContextMenuTriggerProps) {
  const context = useContextMenuContext("ContextMenuTrigger");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchOrigin = useRef<MenuPoint | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchOrigin.current = null;
  }, []);

  useEffect(() => cancelLongPress, [cancelLongPress]);

  if (!isValidElement(children)) {
    throw new Error("<ContextMenuTrigger> requires a single React element");
  }

  const childProps = children.props;
  const childRef = children.props.ref;

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    childProps.onPointerDown?.(event);
    if (event.defaultPrevented || disabled || event.pointerType !== "touch") return;

    const origin = { x: event.clientX, y: event.clientY };
    touchOrigin.current = origin;
    longPressTimer.current = setTimeout(() => {
      context.openAt(origin, "touch");
      longPressTimer.current = null;
      touchOrigin.current = null;
    }, LONG_PRESS_DELAY);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    childProps.onPointerMove?.(event);
    const origin = touchOrigin.current;
    if (
      origin &&
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >
        LONG_PRESS_TOLERANCE
    ) {
      cancelLongPress();
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    childProps.onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10"))
      return;

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    context.openAt(
      { x: rect.left + Math.min(24, rect.width / 2), y: rect.top + rect.height / 2 },
      "keyboard",
    );
  };

  return cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      context.triggerRef.current = node;
      assignRef(childRef, node);
    },
    "aria-controls": context.open ? context.menuId : undefined,
    "aria-haspopup": "menu",
    "aria-expanded": context.open,
    className: cn(childProps.className, className),
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      childProps.onContextMenu?.(event);
      if (event.defaultPrevented || disabled) return;
      event.preventDefault();
      cancelLongPress();
      context.openAt({ x: event.clientX, y: event.clientY }, "pointer");
    },
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      childProps.onPointerUp?.(event);
      cancelLongPress();
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
      childProps.onPointerCancel?.(event);
      cancelLongPress();
    },
  });
}

export interface ContextMenuContentProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function ContextMenuContent({
  children,
  className,
  ariaLabel = "Context menu",
}: ContextMenuContentProps) {
  const context = useContextMenuContext("ContextMenuContent");
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPoint>(context.point);
  const [origin, setOrigin] = useState<MenuPoint>({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [morphReady, setMorphReady] = useState(false);
  const typeahead = useRef("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!context.open) {
      setMorphReady(false);
      return;
    }
    const content = context.contentRef.current;
    if (!content) return;
    content.dataset.invocation = String(context.invocation);

    const rect = content.getBoundingClientRect();
    const left = Math.max(
      VIEWPORT_PADDING,
      Math.min(
        Math.max(context.point.x, VIEWPORT_PADDING),
        window.innerWidth - rect.width - VIEWPORT_PADDING,
      ),
    );
    const top = Math.max(
      VIEWPORT_PADDING,
      Math.min(
        Math.max(context.point.y, VIEWPORT_PADDING),
        window.innerHeight - rect.height - VIEWPORT_PADDING,
      ),
    );

    setPosition({ x: left, y: top });
    setSize({ width: rect.width, height: rect.height });
    setOrigin({
      x: clamp(context.point.x - left, 12, Math.max(12, rect.width - 12)),
      y: clamp(context.point.y - top, 12, Math.max(12, rect.height - 12)),
    });
    setMorphReady(false);

    if (context.reduce || context.modality === "keyboard") {
      setMorphReady(true);
      return;
    }

    let openFrame = 0;
    const prepareFrame = requestAnimationFrame(() => {
      openFrame = requestAnimationFrame(() => setMorphReady(true));
    });
    return () => {
      cancelAnimationFrame(prepareFrame);
      cancelAnimationFrame(openFrame);
    };
  }, [
    context.open,
    context.point,
    context.contentRef,
    context.invocation,
    context.modality,
    context.reduce,
  ]);

  useEffect(() => {
    if (!context.open) return;
    // 仅在通过键盘唤起（ContextMenu键/Shift+F10）时才默认聚焦首项，防止鼠标右键打开时突兀的白块闪烁与飞行动画
    if (context.modality === "keyboard") {
      const frame = requestAnimationFrame(() => {
        const first = getEnabledItems(context.contentRef.current)[0];
        first?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [context.open, context.contentRef, context.modality]);

  useEffect(
    () => () => {
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    },
    [],
  );

  const moveFocus = (direction: 1 | -1) => {
    const items = getEnabledItems(context.contentRef.current);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = current < 0 ? 0 : (current + direction + items.length) % items.length;
    items[next]?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      context.setOpen(false);
      context.triggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      context.setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const items = getEnabledItems(context.contentRef.current);
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
      return;
    }
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      typeahead.current += event.key.toLocaleLowerCase();
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
      typeaheadTimer.current = setTimeout(() => {
        typeahead.current = "";
      }, 500);
      const match = getEnabledItems(context.contentRef.current).find((item) =>
        (item.dataset.label ?? item.textContent ?? "")
          .trim()
          .toLocaleLowerCase()
          .startsWith(typeahead.current),
      );
      match?.focus();
    }
  };

  if (!mounted) return null;

  const visualOpen = context.open && morphReady;
  const clipHidden = collapsedClip(origin, size);
  const clipShown = "inset(0px 0px 0px 0px round 12px)";

  return createPortal(
    <div
      data-context-menu-portal=""
      aria-hidden={!context.open}
      inert={!context.open}
      style={{ left: position.x, top: position.y }}
      className={cn(
        "fixed z-[100] [filter:drop-shadow(0_12px_24px_rgba(0,0,0,0.18))]",
        context.open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <motion.div
        ref={context.contentRef}
        id={context.menuId}
        role="menu"
        aria-label={ariaLabel}
        data-morph-ready={morphReady ? "true" : "false"}
        tabIndex={-1}
        initial={false}
        animate={{
          opacity: visualOpen ? 1 : 0,
          clipPath:
            context.reduce || context.modality === "keyboard" || visualOpen
              ? clipShown
              : clipHidden,
        }}
        transition={
          context.modality === "keyboard"
            ? { duration: 0 }
            : context.reduce
              ? { duration: 0.1, ease: EASE_OUT }
              : {
                  clipPath: {
                    duration: MORPH_DURATION,
                    ease: EASE_OUT,
                  },
                  opacity: {
                    duration: MORPH_DURATION,
                    ease: EASE_OUT,
                  },
                }
        }
        onKeyDown={onKeyDown}
        onPointerLeave={() => {
          context.setActiveId(null);
        }}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          "min-w-52 overflow-hidden rounded-[var(--rx-r-l,12px)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elevated,var(--rx-bg))] p-1.5 text-[var(--rx-fg)] backdrop-blur-xl shadow-xl outline-none",
          className,
        )}
      >
        <LayoutGroup id={`${context.menuId}-${context.invocation}`}>
          {children}
        </LayoutGroup>
      </motion.div>
    </div>,
    document.body,
  );
}

type ContextMenuItemTone = "default" | "destructive";

export interface ContextMenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  closeOnSelect?: boolean;
  tone?: ContextMenuItemTone;
  inset?: boolean;
  className?: string;
  textValue?: string;
}

function ContextMenuItemBase({
  children,
  onSelect,
  disabled = false,
  closeOnSelect = true,
  tone = "default",
  inset = false,
  className,
  textValue,
  role = "menuitem",
  ariaChecked,
}: ContextMenuItemProps & {
  role?: "menuitem" | "menuitemcheckbox" | "menuitemradio";
  ariaChecked?: boolean;
}) {
  const context = useContextMenuContext("ContextMenuItem");
  const id = useId();
  const active = context.activeId === id;
  const checkedProps =
    role === "menuitem" ? {} : { "aria-checked": ariaChecked };

  return (
    <button
      type="button"
      id={id}
      role={role}
      {...checkedProps}
      disabled={disabled}
      data-context-menu-item="true"
      data-disabled={disabled ? "true" : undefined}
      data-label={textValue}
      tabIndex={-1}
      onFocus={() => context.setActiveId(id)}
      onPointerEnter={(event) => {
        if (!disabled && event.pointerType !== "touch") {
          context.setActiveId(id);
        }
      }}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        if (closeOnSelect) context.setOpen(false);
      }}
      className={cn(
        "relative isolate flex w-full select-none items-center gap-2 rounded-[var(--rx-r-m,8px)] px-2.5 py-1.5 text-left text-body-sm font-medium outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--rx-accent)]/30",
        "disabled:pointer-events-none disabled:opacity-40",
        inset && "pl-7",
        tone === "destructive"
          ? (active ? "text-red-600 dark:text-red-400 font-semibold" : "text-red-500/90 dark:text-red-400/90")
          : (active ? "text-[var(--rx-accent)] font-semibold" : "text-[var(--rx-fg)]"),
        className,
      )}
    >
      {active ? (
        <motion.span
          layoutId="active-pill"
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 rounded-[var(--rx-r-m,8px)]",
            tone === "destructive"
              ? "bg-red-500/12 dark:bg-red-500/20"
              : "bg-[var(--rx-accent-soft)] dark:bg-[var(--rx-accent-soft)]/80 shadow-2xs border border-[var(--rx-accent)]/15",
          )}
          transition={context.reduce ? { duration: 0 } : SPRING_LAYOUT}
        />
      ) : null}
      {children}
    </button>
  );
}

export function ContextMenuItem(props: ContextMenuItemProps) {
  return <ContextMenuItemBase {...props} />;
}

export interface ContextMenuCheckboxItemProps
  extends Omit<ContextMenuItemProps, "onSelect"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function ContextMenuCheckboxItem({
  checked,
  onCheckedChange,
  children,
  ...props
}: ContextMenuCheckboxItemProps) {
  const context = useContextMenuContext("ContextMenuCheckboxItem");
  return (
    <ContextMenuItemBase
      {...props}
      role="menuitemcheckbox"
      ariaChecked={checked}
      onSelect={() => onCheckedChange?.(!checked)}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <AnimatePresence initial={false}>
          {checked ? (
            <motion.span
              key="check"
              initial={context.reduce ? false : { opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: context.reduce ? 1 : 0.75 }}
              transition={context.reduce ? { duration: 0.08 } : SPRING_PANEL}
            >
              <Check aria-hidden="true" className="h-3.5 w-3.5 text-[var(--rx-accent)]" strokeWidth={2.4} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
      {children}
    </ContextMenuItemBase>
  );
}

interface ContextMenuRadioGroupContextValue {
  value: string;
  onValueChange?: (value: string) => void;
}

const ContextMenuRadioGroupContext =
  createContext<ContextMenuRadioGroupContextValue | null>(null);

export interface ContextMenuRadioGroupProps {
  value: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function ContextMenuRadioGroup({
  value,
  onValueChange,
  children,
  className,
}: ContextMenuRadioGroupProps) {
  const context = useMemo(
    () => ({ value, onValueChange }),
    [value, onValueChange],
  );
  return (
    <ContextMenuRadioGroupContext.Provider value={context}>
      <div className={className}>{children}</div>
    </ContextMenuRadioGroupContext.Provider>
  );
}

export interface ContextMenuRadioItemProps
  extends Omit<ContextMenuItemProps, "onSelect"> {
  value: string;
}

export function ContextMenuRadioItem({
  value,
  children,
  ...props
}: ContextMenuRadioItemProps) {
  const group = useContext(ContextMenuRadioGroupContext);
  if (!group) {
    throw new Error(
      "ContextMenuRadioItem must be used within <ContextMenuRadioGroup>",
    );
  }
  const checked = group.value === value;
  return (
    <ContextMenuItemBase
      {...props}
      role="menuitemradio"
      ariaChecked={checked}
      onSelect={() => group.onValueChange?.(value)}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-[var(--rx-accent)] transition-opacity",
            checked ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
      {children}
    </ContextMenuItemBase>
  );
}

export interface ContextMenuLabelProps {
  children: ReactNode;
  inset?: boolean;
  className?: string;
}

export function ContextMenuLabel({
  children,
  inset = false,
  className,
}: ContextMenuLabelProps) {
  return (
    <div
      className={cn(
        "px-2.5 pb-1 pt-1.5 text-micro-xxs font-bold uppercase tracking-wider text-[var(--rx-fg-faint)]",
        inset && "pl-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ContextMenuSeparatorProps {
  className?: string;
}

export function ContextMenuSeparator({
  className,
}: ContextMenuSeparatorProps) {
  return (
    <hr className={cn("-mx-1 my-1 h-px border-0 bg-[var(--rx-border-soft)]", className)} />
  );
}

export interface ContextMenuShortcutProps {
  children: ReactNode;
  className?: string;
}

export function ContextMenuShortcut({
  children,
  className,
}: ContextMenuShortcutProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-auto pl-4 font-mono text-micro-xxs font-medium tracking-wide text-[var(--rx-fg-faint)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
