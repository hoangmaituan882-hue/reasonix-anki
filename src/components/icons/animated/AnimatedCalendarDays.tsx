import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const calVariants: Variants = {
  normal: {
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    y: [-1, -2.5, 0],
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.55,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const dotVariants = (delay: number): Variants => ({
  normal: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    scale: [1, 1.5, 1],
    opacity: [1, 0.5, 1],
    transition: {
      duration: 0.5,
      delay,
      ease: "easeInOut",
    },
  },
});

export function AnimatedCalendarDays({
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
        variants={calVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      >
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h18" />
        <motion.path
          d="M8 14h.01"
          variants={dotVariants(0)}
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "8px 14px" }}
        />
        <motion.path
          d="M12 14h.01"
          variants={dotVariants(0.08)}
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "12px 14px" }}
        />
        <motion.path
          d="M16 14h.01"
          variants={dotVariants(0.16)}
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "16px 14px" }}
        />
        <motion.path
          d="M8 18h.01"
          variants={dotVariants(0.08)}
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "8px 18px" }}
        />
        <motion.path
          d="M12 18h.01"
          variants={dotVariants(0.16)}
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "12px 18px" }}
        />
        <motion.path
          d="M16 18h.01"
          variants={dotVariants(0.24)}
          animate={controls}
          initial="normal"
          style={{ transformOrigin: "16px 18px" }}
        />
      </motion.g>
    </svg>
  );
}
