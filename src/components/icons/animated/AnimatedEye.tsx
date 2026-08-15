import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const eyeLidVariants: Variants = {
  normal: {
    scaleY: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    scaleY: [1, 0.4, 1.1, 1],
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
};

const pupilVariants: Variants = {
  normal: {
    x: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    x: [0, 2, -2, 0],
    scale: [1, 1.2, 0.9, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
};

export function AnimatedEye({
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
        d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
        variants={eyeLidVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      />
      <motion.circle
        cx="12"
        cy="12"
        r="3"
        variants={pupilVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      />
    </svg>
  );
}
