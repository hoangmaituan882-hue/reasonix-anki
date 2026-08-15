import { motion, type Variants } from "motion/react";
import type { AnimatedIconProps } from "./types";
import { useIconAnimation } from "./useIconAnimation";

const mainStarVariants: Variants = {
  normal: {
    rotate: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    rotate: [0, 15, -10, 0],
    scale: [1, 1.2, 0.9, 1],
    transition: {
      duration: 0.65,
      ease: "easeInOut",
    },
  },
};

const smallStarVariants = (delay: number): Variants => ({
  normal: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  animate: {
    scale: [1, 1.4, 0.8, 1],
    opacity: [1, 0.4, 1],
    transition: {
      duration: 0.5,
      delay,
      ease: "easeInOut",
    },
  },
});

export function AnimatedSparkles({
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
        d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"
        variants={mainStarVariants}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "12px 12px" }}
      />
      <motion.path
        d="M5 3v4"
        variants={smallStarVariants(0.08)}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "5px 5px" }}
      />
      <motion.path
        d="M19 17v4"
        variants={smallStarVariants(0.16)}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "19px 19px" }}
      />
      <motion.path
        d="M3 5h4"
        variants={smallStarVariants(0.08)}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "5px 5px" }}
      />
      <motion.path
        d="M17 19h4"
        variants={smallStarVariants(0.16)}
        animate={controls}
        initial="normal"
        style={{ transformOrigin: "19px 19px" }}
      />
    </svg>
  );
}
