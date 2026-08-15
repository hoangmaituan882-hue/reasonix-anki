import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const sunVariants: Variants = {
  normal: {
    y: 0,
    rotate: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    y: [-0.5, -2, 0],
    rotate: [0, 45, 0],
    scale: [1, 1.1, 1],
    transition: {
      duration: 0.7,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const cloudVariants: Variants = {
  normal: {
    x: 0,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    x: [0, -1, 1, 0],
    y: [0, -0.5, 0],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
    },
  },
};

export function AnimatedCloudSun({
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
        variants={sunVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      >
        <path d="M12 2v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="M20 12h2" />
        <path d="m19.07 4.93-1.41 1.41" />
        <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
      </motion.g>
      <motion.path
        d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"
        variants={cloudVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 19px" }}
      />
    </svg>
  );
}
