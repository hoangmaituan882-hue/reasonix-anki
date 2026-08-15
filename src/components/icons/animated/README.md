# Reasonix Anki 微交互图标开发与维护规范

> **规范源**：严格遵循 [Lucide Animated (pqoqubbw/icons)](https://lucide-animated.com/) 与 [Framer Motion / Motion](https://motion.dev/) 规范。
> **适用范围**：`src/components/icons/animated/` 目录下全部动态微交互图标。

---

## 1. 核心设计原则

1. **统一驱动 Hook**：
   - 必须使用 `useIconAnimation({ isHovered, trigger, onMouseEnter, onMouseLeave })`；
   - 支持受控状态（`isHovered`）、父级手动触发（`trigger` 计数累加）与非受控鼠标悬停；
   - 避免在组件挂载瞬间（Initial mount）产生多余的非预期动画。

2. **状态机 Variants 纪律**：
   - 动画声明为 `Variants`，必须包含 `normal` 与 `animate` 两个状态；
   - `normal` 必须是标准的静止复位态：`{ rotate: 0, scale: 1, x: 0, y: 0 }`；
   - 动画播放完毕或鼠标离开时必须**100% 自动归位至 `normal`**，严禁使用会持续累加角度的算法（如 `clickCount * -15` 等导致歪斜）。

3. **矢量层级完整性（防残留静止残影）**：
   - 根节点统一为标准 `<svg>`，设置 `style={{ overflow: "visible" }}`；
   - 图标动效主体统一使用 `<motion.g variants={...} animate={controls} initial="normal" style={{ transformOrigin: "center center" }}>` 或指定中心（如 `"12px 12px"`）；
   - 复合部件（如流苏、眼睛、云朵、光斑）必须作为子节点嵌套在整体坐标系内，杜绝分离图层导致的“底座不动、子图层乱飘”或“原地留下静止笔画”。

4. **关键帧与缓动纪律**：
   - 多关键帧（3 个及以上，如 `rotate: [0, -8, 4, 0]`）**严禁**与 `type: "spring"` 混用（Motion 会抛出 Invariant 异常）；
   - 多关键帧必须使用标准贝塞尔曲线（如 `ease: [0.25, 0.1, 0.25, 1]`）或 `easeInOut`；
   - 双点变换（如 0 到 180°）推荐 `duration: 0.5 ~ 0.7s`。

5. **无障碍与微交互**：
   - 用户主动发起的 Hover / Click 微交互属于明确的交互反馈，禁止使用全局覆盖将 `animate={}` 置空破坏交互感。

---

## 2. 标准组件代码模板

```tsx
import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const iconVariants: Variants = {
  normal: {
    rotate: 0,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    rotate: [0, -8, 4, 0],
    scale: [1, 1.1, 1],
    y: [0, -2, 0],
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function AnimatedSampleIcon({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  className,
  isHovered,
  trigger,
  onMouseEnter,
  onMouseLeave,
  style,
  ...props
}: AnimatedIconProps) {
  const { controls, handleMouseEnter, handleMouseLeave } = useIconAnimation({
    isHovered,
    trigger,
    onMouseEnter,
    onMouseLeave,
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ overflow: "visible", ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <motion.g
        variants={iconVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      >
        {/* 矢量路径 */}
      </motion.g>
    </svg>
  );
}
```
