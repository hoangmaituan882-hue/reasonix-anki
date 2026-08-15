import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const puzzleVariants: Variants = {
  normal: {
    rotate: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    rotate: [0, 15, -10, 5, 0],
    scale: [1, 1.1, 1],
    transition: {
      duration: 0.65,
      ease: "easeInOut",
    },
  },
};

export function AnimatedPuzzle({
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
        variants={puzzleVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      >
        <path d="M19.439 7.85c0-1.57.802-2.85 1.79-2.85s1.79 1.28 1.79 2.85a3.12 3.12 0 0 1-1.79 2.85v4.3A2.85 2.85 0 0 1 18.379 18h-4.3a3.12 3.12 0 0 1-2.85-1.79c-1.57 0-2.85.8-2.85 1.79s1.28 1.79 2.85 1.79a3.12 3.12 0 0 1 2.85 1.79H6.86A2.86 2.86 0 0 1 4 18.72v-7.14a3.12 3.12 0 0 1 1.79-2.85c0-1.57-.8-2.85-1.79-2.85S2.21 7.16 2.21 8.73A3.12 3.12 0 0 1 4 11.58V4.44A2.44 2.44 0 0 1 6.44 2h7.14a3.12 3.12 0 0 1 2.85 1.79c1.57 0 2.85-.8 2.85-1.79s-1.28-1.79-2.85-1.79A3.12 3.12 0 0 1 13.58 2h5.86Z" />
      </motion.g>
    </svg>
  );
}
