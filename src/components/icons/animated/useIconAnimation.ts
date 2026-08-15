import { useCallback, useEffect, useRef, useState } from "react";
import { useAnimation } from "motion/react";
import type { AnimatedIconProps } from "./types";

type AnimationControls = ReturnType<typeof useAnimation>;

export function useIconAnimation({
  isHovered,
  trigger,
  onMouseEnter,
  onMouseLeave,
}: Pick<AnimatedIconProps, "isHovered" | "trigger" | "onMouseEnter" | "onMouseLeave">): {
  controls: AnimationControls;
  handleMouseEnter: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseLeave: (e: React.MouseEvent<SVGSVGElement>) => void;
  active: boolean;
} {
  const controls = useAnimation();
  const [internalHover, setInternalHover] = useState(false);
  const active = isHovered ?? internalHover;
  const prevTrigger = useRef(trigger);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (active) {
      void controls.start("animate");
    } else {
      void controls.start("normal");
    }
  }, [active, controls]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (trigger !== undefined && trigger !== prevTrigger.current) {
      prevTrigger.current = trigger;
      void controls.start("animate").then(() => {
        if (!active) {
          void controls.start("normal");
        }
      });
    }
  }, [trigger, active, controls]);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      setInternalHover(true);
      onMouseEnter?.(e);
    },
    [onMouseEnter],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      setInternalHover(false);
      onMouseLeave?.(e);
    },
    [onMouseLeave],
  );

  return { controls, handleMouseEnter, handleMouseLeave, active };
}
