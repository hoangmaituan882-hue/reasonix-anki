import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const saveVariants: Variants = {
  normal: {
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    y: [-1, -2, 0],
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.55,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const sliderVariants: Variants = {
  normal: {
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    y: [0, -2, 0],
    transition: {
      duration: 0.45,
      delay: 0.05,
    },
  },
};

export function AnimatedSave({
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
        variants={saveVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      >
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <motion.polyline
          points="7 3 7 8 15 8"
          variants={sliderVariants}
          animate={controls}
          initial="normal"
        />
      </motion.g>
    </svg>
  );
}
