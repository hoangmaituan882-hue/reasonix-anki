import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const antennaVariants: Variants = {
  normal: {
    rotate: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    rotate: [0, -18, 12, -6, 0],
    transition: {
      duration: 0.65,
      ease: "easeInOut",
    },
  },
};

const eyeVariants: Variants = {
  normal: {
    scaleY: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    scaleY: [1, 0.2, 1.2, 1],
    transition: {
      duration: 0.45,
      delay: 0.1,
    },
  },
};

export function AnimatedBot({
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
        d="M12 8V4H8"
        variants={antennaVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 8px" }}
      />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <motion.path
        d="M9 13v2"
        variants={eyeVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "9px 14px" }}
      />
      <motion.path
        d="M15 13v2"
        variants={eyeVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "15px 14px" }}
      />
    </svg>
  );
}
