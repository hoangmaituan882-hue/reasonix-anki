import React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@reasonix/ui";

/**
 * ==============================================================================
 * SettingsControls - Reasonix 标准设置布尔控件规范
 * ==============================================================================
 *
 * 【场景分工原则】：
 * 1. Checkbox（方块，在左）：
 *    - 语义：从集合中多选 / 列表项 / 批量配置勾选。
 *    - 布局：20×20px 方块 (rounded-md) 在左，文字在右（flex items-center gap-3）。
 *    - 优势：多个条目纵向排成一列，方块统一在左侧对齐，眼睛可沿左边缘快速扫视勾选状态。
 *
 * 2. Toggle（胶囊，在右）：
 *    - 语义：单项全局功能开/关，立即生效。
 *    - 布局：所在行用 flex items-center justify-between，标题与描述在左、Toggle 顶到最右侧。
 *    - 优势：强调二元开/关状态，右侧拨动不打断左侧标题的阅读。
 * ==============================================================================
 */

export interface CheckboxProps {
  id?: string;
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  badge?: React.ReactNode;
}

/**
 * ① Checkbox —— "方块"在左边，文字在右边
 *
 * 形状：20×20px 圆角方块 (rounded-md)，选中后品牌色填充 + Check 图标；半选态显示 Minus 图标。
 * 布局：flex items-center gap-3（方块在前、文字在后），视觉上方块永远在文字左边。
 */
export function Checkbox({
  id,
  checked = false,
  indeterminate = false,
  onChange,
  label,
  description,
  disabled = false,
  className,
  badge,
}: CheckboxProps) {
  const isSelected = checked || indeterminate;

  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled && onChange) {
          onChange(!checked);
        }
      }}
      className={cn(
        "group w-full flex items-start text-left select-none transition-all rx-press py-2 px-3 rounded-xl hover:bg-[var(--rx-sidebar-hover)]/70 active:scale-[0.99]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className
      )}
    >
      <div className="flex items-center gap-3 w-full">
        {/* 方块：20×20px (w-5 h-5 aspect-square rounded-md) 在左侧 */}
        <span
          className={cn(
            "w-5 h-5 aspect-square shrink-0 rounded-md border flex items-center justify-center transition-all duration-150 ease-out",
            isSelected
              ? "bg-[var(--rx-accent)] border-[var(--rx-accent)] text-[var(--rx-accent-fg)] shadow-xs"
              : "border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/50 group-hover:border-[var(--rx-accent)] group-hover:bg-[var(--rx-bg-soft)]"
          )}
        >
          {checked && !indeterminate && (
            <Check className="h-3.5 w-3.5 stroke-[3] text-white" />
          )}
          {indeterminate && (
            <Minus className="h-3.5 w-3.5 stroke-[3] text-white" />
          )}
        </span>

        {/* 文字与说明：跟在方块右侧 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-[15px] font-bold text-[var(--rx-fg)] transition-colors leading-[1.4]",
                isSelected && "font-bold"
              )}
            >
              {label}
            </span>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="text-[14px] font-normal text-[var(--rx-fg)]/80 leading-[1.5] mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export interface ToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

/**
 * ② Toggle —— 胶囊开关
 *
 * 形状：胶囊轨道 (rounded-full, 44×24px) + 圆形滑块，打开时滑块滑向右侧、轨道变品牌色。
 */
export function Toggle({
  id,
  checked,
  onChange,
  disabled = false,
  className,
  size = "md",
}: ToggleProps) {
  const isSm = size === "sm";

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out rx-press select-none focus:outline-hidden",
        isSm ? "h-5 w-9" : "h-6 w-11",
        checked
          ? "bg-[var(--rx-accent)]"
          : "bg-[var(--rx-bg-soft)] border-[var(--rx-border-soft)]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out",
          isSm ? "h-4 w-4" : "h-5 w-5",
          checked
            ? isSm
              ? "translate-x-4"
              : "translate-x-5"
            : "translate-x-0"
        )}
      />
    </button>
  );
}

export interface ToggleRowProps {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/**
 * ToggleRow —— 标题在左、Toggle 顶到最右侧的设置项行
 * 布局：flex items-center justify-between
 * 严格遵从排版规范：
 * 开关标题：字号 16px，字重 600 (Semibold)，主文字色，行高 1.4
 * 开关说明：字号 14px，字重 400 (Regular)，次要文字色（约 65% 不透明度），行高 1.5
 * 间距：标题与说明间距 4px，开关行垂直间距 16～24px (py-4.5)
 */
export function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  disabled = false,
  icon,
  badge,
  className,
}: ToggleRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-4 select-none transition-colors",
        disabled && "opacity-60",
        className
      )}
    >
      <div className="flex flex-col gap-1 pr-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--rx-accent)] shrink-0">{icon}</span>}
          <span className="text-[16px] font-bold text-[var(--rx-fg)] leading-[1.4]">
            {title}
          </span>
          {badge && <span className="shrink-0 ml-1">{badge}</span>}
        </div>
        {description && (
          <div className="text-[14px] font-normal text-[var(--rx-fg)]/80 leading-[1.5]">
            {description}
          </div>
        )}
      </div>

      <Toggle
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

export interface CheckboxGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

/**
 * CheckboxGroup —— 多选条目容器（方块统一在左对齐）
 */
export function CheckboxGroup({
  title,
  description,
  children,
  className,
  headerAction,
}: CheckboxGroupProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/30 p-4 space-y-3",
        className
      )}
    >
      {(title || description || headerAction) && (
        <div className="flex items-center justify-between pb-2 px-1 border-b border-[var(--rx-border-soft)]/60 mb-2">
          <div className="flex flex-col gap-1">
            {title && (
              <div className="text-[18px] font-bold text-[var(--rx-fg)] leading-[1.4]">
                {title}
              </div>
            )}
            {description && (
              <div className="text-[14px] font-normal text-[var(--rx-fg)]/80 leading-[1.5]">
                {description}
              </div>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export {
  useSlider,
  snapSliderValue,
  Slider,
  SliderRow,
  type SliderProps,
  type SliderRowProps,
  type SliderOptions,
} from "./Slider";
