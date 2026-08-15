import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const wave1Variants: Variants = {
  normal: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    opacity: [1, 0.3, 1],
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
};

const wave2Variants: Variants = {
  normal: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    opacity: [1, 0.3, 1],
    scale: [1, 1.3, 1],
    transition: {
      duration: 0.5,
      delay: 0.1,
      ease: "easeInOut",
    },
  },
};

export function AnimatedVolume2({
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
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <motion.path
        d="M15.54 8.46a5 5 0 0 1 0 7.07"
        variants={wave1Variants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "11px 12px" }}
      />
      <motion.path
        d="M19.07 4.93a10 10 0 0 1 0 14.14"
        variants={wave2Variants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "11px 12px" }}
      />
    </svg>
  );
}
