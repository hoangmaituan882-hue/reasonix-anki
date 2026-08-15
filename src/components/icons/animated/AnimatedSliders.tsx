import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const sliderVariants = (dir: number): Variants => ({
  normal: {
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    y: [0, dir * 4, 0],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
});

export function AnimatedSliders({
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
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <motion.line
        x1="2"
        x2="6"
        y1="14"
        y2="14"
        variants={sliderVariants(-1)}
        animate={controls}
        initial="normal"
      />
      <motion.line
        x1="10"
        x2="14"
        y1="8"
        y2="8"
        variants={sliderVariants(1)}
        animate={controls}
        initial="normal"
      />
      <motion.line
        x1="18"
        x2="22"
        y1="16"
        y2="16"
        variants={sliderVariants(-1)}
        animate={controls}
        initial="normal"
      />
    </svg>
  );
}
