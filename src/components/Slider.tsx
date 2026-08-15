import React, {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
  useMemo,
} from "react";
import { cn } from "@reasonix/ui";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Nearest legal value on [min, max] for the given step. max counts as a
 * candidate when the step does not divide the range, so a pointer near the end
 * does not snap back onto the last whole step. */
export function snapSliderValue(next: number, min: number, max: number, step: number): number {
  // Neither case has a grid to walk. An empty range has exactly one legal
  // point, and a non-positive step only needs a clamp, which also keeps the
  // division below away from zero.
  if (!(max > min)) return min;
  if (!(step > 0)) return clamp(next, min, max);
  const whole = Math.floor(Number(((max - min) / step).toFixed(6)));
  const lastWhole = Number((min + whole * step).toFixed(6));
  const toGrid = clamp(Math.round((next - min) / step) * step + min, min, lastWhole);
  const snapped =
    lastWhole < max && Math.abs(next - max) <= Math.abs(next - toGrid) ? max : toGrid;
  return Number(snapped.toFixed(6));
}

export interface SliderOptions {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  "aria-label"?: string;
  /** Announced instead of the raw number — pass one when the value carries a
   * unit or a suffix ("72.5 kg", "35%"); a bare number needs no valueText. */
  formatValueText?: (value: number) => string;
}

/**
 * Shared value + input plumbing for slider designs: controlled/uncontrolled
 * value, step snapping, pointer-capture drag along a track and arrow-key
 * control. Visuals and motion live in the component; this only owns the number.
 */
export function useSlider({
  value,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  "aria-label": ariaLabel,
  formatValueText,
}: SliderOptions) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sliderEl = useRef<HTMLElement | null>(null);
  // The state drives visuals. Move reads this ref instead, so the first
  // pointermove after pointerdown does not have to wait on a re-render.
  const draggingRef = useRef(false);
  const [internal, setInternal] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const controlled = value !== undefined;
  // Collapse inverted or empty ranges and non-positive steps here, so that
  // percent, ticks and the keyboard maths never divide by zero or walk a
  // NaN grid.
  const lo = min;
  const hi = max > min ? max : min;
  const stride = step > 0 ? step : 1;
  const current = clamp(controlled ? value : internal, lo, hi);
  const percent = hi > lo ? ((current - lo) / (hi - lo)) * 100 : 0;

  const commit = useCallback(
    (next: number) => {
      const clean = snapSliderValue(next, lo, hi, stride);
      if (!controlled) setInternal(clean);
      onValueChange?.(clean);
    },
    [controlled, onValueChange, lo, hi, stride],
  );

  const commitFromX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      commit(lo + ratio * (hi - lo));
    },
    [commit, lo, hi],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      // optional: test DOMs and older browsers omit pointer capture
      event.currentTarget.setPointerCapture?.(event.pointerId);
      draggingRef.current = true;
      setDragging(true);
      // A click on the track should land keyboard focus on the handle.
      sliderEl.current?.focus({ preventScroll: true });
      commitFromX(event.clientX);
    },
    [disabled, commitFromX],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || disabled) return;
      commitFromX(event.clientX);
    },
    [disabled, commitFromX],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    // Releasing without capture throws. The other pointer hooks guard it the
    // same way.
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingRef.current = false;
    setDragging(false);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      const map: Record<string, number> = {
        ArrowRight: current + stride,
        ArrowUp: current + stride,
        ArrowLeft: current - stride,
        ArrowDown: current - stride,
        PageUp: current + stride * 10,
        PageDown: current - stride * 10,
        Home: lo,
        End: hi,
      };
      if (event.key in map) {
        event.preventDefault();
        commit(map[event.key]);
      }
    },
    [disabled, current, stride, lo, hi, commit],
  );

  return {
    current,
    percent,
    dragging,
    min: lo,
    max: hi,
    step: stride,
    commit,
    /** Pointer handlers for the track element — drag anywhere on it. */
    trackProps: {
      ref: trackRef,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
    },
    /** ARIA + keyboard props for the focusable slider element. */
    sliderProps: {
      // Callback keeps the handle typed across button/div/motion hosts.
      ref: (node: HTMLElement | null) => {
        sliderEl.current = node;
      },
      role: "slider" as const,
      tabIndex: disabled ? -1 : 0,
      "aria-label": ariaLabel,
      "aria-valuemin": lo,
      "aria-valuemax": hi,
      "aria-valuenow": current,
      "aria-valuetext": formatValueText?.(current),
      "aria-disabled": disabled || undefined,
      onKeyDown,
    },
  };
}

export interface SliderProps extends SliderOptions {
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  thumbClassName?: string;
  showTicks?: boolean;
  accentColor?: string;
}

/**
 * 胶囊点阵滑块组件 (Reasonix Dot-Track Capsule Slider)
 * 适配软件整体设计令牌（var(--rx-*)）：
 * - 宽厚圆角胶囊底槽：var(--rx-bg-soft) + var(--rx-border-soft)
 * - 左侧已选填充：var(--rx-accent-soft) / 动态强调色
 * - 中轴线等距圆点刻度：var(--rx-fg) 优雅透光点阵
 * - 垂直胶囊手柄：var(--rx-fg) / var(--rx-accent) 随暗黑与主题方向自适应
 */
export function Slider({
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  "aria-label": ariaLabel,
  formatValueText,
  className,
  trackClassName,
  fillClassName,
  thumbClassName,
  showTicks = true,
  accentColor,
}: SliderProps) {
  const { percent, dragging, trackProps, sliderProps } = useSlider({
    value,
    defaultValue,
    onValueChange,
    min,
    max,
    step,
    disabled,
    "aria-label": ariaLabel,
    formatValueText,
  });

  // 计算中轴线上的点阵刻度
  const tickPercentages = useMemo(() => {
    if (!showTicks || max <= min) return [];
    const span = max - min;
    const totalSteps = Math.round(span / (step > 0 ? step : 1));
    
    // 如果步数适中（<= 25），显示每个 step 的点；如果很多，则均匀采样 16-20 个点
    if (totalSteps >= 2 && totalSteps <= 25) {
      return Array.from({ length: totalSteps + 1 }, (_, i) => (i / totalSteps) * 100);
    } else {
      const sampleCount = 16;
      return Array.from({ length: sampleCount + 1 }, (_, i) => (i / sampleCount) * 100);
    }
  }, [showTicks, min, max, step]);

  return (
    <div
      className={cn(
        "relative flex w-full touch-none select-none items-center py-1.5",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      {...trackProps}
    >
      {/* 宽厚圆角胶囊轨道容器 */}
      <div
        className={cn(
          "relative w-full h-7 rounded-[10px] bg-[var(--rx-bg-soft)] overflow-hidden transition-colors border border-[var(--rx-border-soft)] shadow-2xs",
          trackClassName
        )}
      >
        {/* 左侧已选填充层（自适应 Reasonix 主题方向柔和色） */}
        <div
          className={cn(
            "h-full transition-all duration-75 ease-out",
            accentColor ? "" : "bg-[var(--rx-accent-soft)]",
            fillClassName
          )}
          style={{
            width: `${percent}%`,
            backgroundColor: accentColor ? `${accentColor}28` : undefined,
          }}
        />

        {/* 中轴线等距微圆点阵刻度 */}
        {showTicks && (
          <div className="absolute inset-0 pointer-events-none flex items-center">
            {tickPercentages.map((pct, idx) => (
              <div
                key={idx}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--rx-fg)]/20 dark:bg-[var(--rx-fg)]/30 transition-colors"
                style={{ left: `${pct}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 垂直胶囊手柄 (Vertical Pill Handle / Thumb) */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-7 rounded-full shadow-xs transition-transform duration-100 ease-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--rx-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rx-bg)] rx-press",
          accentColor
            ? ""
            : "bg-[var(--rx-fg)] text-[var(--rx-bg)]",
          dragging
            ? "scale-y-108 scale-x-120 shadow-md ring-2 ring-[var(--rx-accent)]/30"
            : "hover:scale-y-104",
          disabled && "bg-[var(--rx-fg-faint)]/40",
          thumbClassName
        )}
        style={{
          left: `${percent}%`,
          backgroundColor: accentColor || undefined,
        }}
        {...sliderProps}
      />
    </div>
  );
}

export interface SliderRowProps extends SliderProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  unit?: string;
  formatDisplayValue?: (val: number) => React.ReactNode;
  marks?: { value: number; label: string }[];
}

/**
 * 设置面板标准行滑块 (SliderRow)
 * 完美遵循 Reasonix 排版、语义色板与字阶规范
 */
export function SliderRow({
  label,
  description,
  icon,
  unit,
  formatDisplayValue,
  marks,
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled,
  accentColor,
  className,
  ...rest
}: SliderRowProps) {
  const displayVal =
    formatDisplayValue?.(value ?? 0) ?? (unit ? `${value} ${unit}` : value);

  return (
    <div className={cn("space-y-1.5 py-2", disabled && "opacity-60", className)}>
      {/* 顶部标签与数值显示 */}
      <div className="flex items-center justify-between text-body-sm">
        <div className="flex items-center gap-1.5 text-body-sm font-semibold text-[var(--rx-fg)]">
          {icon && (
            <span
              className="shrink-0 text-[var(--rx-accent)]"
              style={{ color: accentColor || undefined }}
            >
              {icon}
            </span>
          )}
          <span>{label}</span>
        </div>
        <span
          className="text-body-sm font-bold font-mono text-[var(--rx-accent)]"
          style={{ color: accentColor || undefined }}
        >
          {displayVal}
        </span>
      </div>

      {description && (
        <p className="text-caption-xs text-[var(--rx-fg-faint)] leading-normal">
          {description}
        </p>
      )}

      {/* 胶囊点阵滑块 */}
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={onValueChange}
        disabled={disabled}
        accentColor={accentColor}
        {...rest}
      />

      {marks && marks.length > 0 && (
        <div className="flex justify-between text-micro-xxs text-[var(--rx-fg-faint)] font-mono px-0.5 select-none pt-0.5">
          {marks.map((m, idx) => (
            <span key={idx}>{m.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
