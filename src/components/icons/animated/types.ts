import type { CSSProperties, MouseEventHandler } from "react";

export interface AnimatedIconProps {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  className?: string;
  isHovered?: boolean;
  trigger?: boolean | number;
  onMouseEnter?: MouseEventHandler<SVGSVGElement>;
  onMouseLeave?: MouseEventHandler<SVGSVGElement>;
  onClick?: MouseEventHandler<SVGSVGElement>;
  style?: CSSProperties;
  "data-testid"?: string;
  "aria-hidden"?: boolean | "true" | "false";
}
