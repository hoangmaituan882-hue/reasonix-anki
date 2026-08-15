import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const spinVariants: Variants = {
  normal: {
    rotate: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    rotate: 360,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function AnimatedRotateCw({
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
        variants={spinVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </motion.g>
    </svg>
  );
}
