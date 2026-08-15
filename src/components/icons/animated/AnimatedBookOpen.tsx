import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const bookVariants: Variants = {
  normal: {
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    scale: 1.1,
    y: -2,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function AnimatedBookOpen({
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
        variants={bookVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 14px" }}
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </motion.g>
    </svg>
  );
}
