import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const barVariants = (delay: number): Variants => ({
  normal: {
    scaleY: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    scaleY: [1, 1.3, 0.8, 1.1, 1],
    transition: {
      duration: 0.6,
      delay,
      ease: "easeInOut",
    },
  },
});

export function AnimatedBarChart3({
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
      <path d="M3 3v18h18" />
      <motion.path
        d="M18 17V9"
        variants={barVariants(0.16)}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "18px 17px" }}
      />
      <motion.path
        d="M13 17V5"
        variants={barVariants(0.08)}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "13px 17px" }}
      />
      <motion.path
        d="M8 17v-3"
        variants={barVariants(0)}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "8px 17px" }}
      />
    </svg>
  );
}
