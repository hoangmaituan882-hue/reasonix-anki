import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const checkVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    scale: [1, 1.15, 1],
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const pathVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      duration: 0.45,
      ease: "easeOut",
    },
  },
};

export function AnimatedCheckCircle2({
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
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        variants={checkVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      />
      <motion.path
        d="m9 12 2 2 4-4"
        variants={pathVariants}
        animate={controls}
        initial="normal"
      />
    </svg>
  );
}
