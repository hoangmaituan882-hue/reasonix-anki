import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const bookTiltVariants: Variants = {
  normal: {
    rotate: 0,
    originX: "16px",
    originY: "20px",
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    rotate: [0, -15, 0],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
};

export function AnimatedLibrary({
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
      <motion.path
        d="m16 6 4 14"
        variants={bookTiltVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "16px 20px" }}
      />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
  );
}
