import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const capVariants: Variants = {
  normal: {
    y: 0,
    rotate: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    y: [-1, -3, 0],
    rotate: [0, -8, 4, 0],
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1],
      times: [0, 0.4, 0.7, 1],
    },
  },
};

const tasselVariants: Variants = {
  normal: {
    rotate: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    rotate: [0, 22, -15, 8, 0],
    transition: {
      duration: 0.7,
      ease: "easeInOut",
    },
  },
};

export function AnimatedGraduationCap({
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
        variants={capVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      >
        <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
        <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
        <motion.path
          d="M22 10v6"
          variants={tasselVariants}
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "22px 10px" }}
        />
      </motion.g>
    </svg>
  );
}
