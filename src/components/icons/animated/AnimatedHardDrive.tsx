import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const driveVariants: Variants = {
  normal: {
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    y: [-1, -2, 0],
    scale: [1, 1.06, 1],
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const ledVariants = (delay: number): Variants => ({
  normal: {
    opacity: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    opacity: [1, 0.2, 1, 0.2, 1],
    transition: {
      duration: 0.5,
      delay,
    },
  },
});

export function AnimatedHardDrive({
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
        variants={driveVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      >
        <line x1="22" x2="2" y1="12" y2="12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        <motion.line
          x1="6"
          x2="6.01"
          y1="16"
          y2="16"
          variants={ledVariants(0)}
          animate={controls}
          initial="normal"
        />
        <motion.line
          x1="10"
          x2="10.01"
          y1="16"
          y2="16"
          variants={ledVariants(0.12)}
          animate={controls}
          initial="normal"
        />
      </motion.g>
    </svg>
  );
}
