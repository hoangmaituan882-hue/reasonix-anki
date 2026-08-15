import React from "react";

export type WidgetCategory = "all" | "memory" | "time" | "analytics" | "fun";
export type WidgetSize = "1x1" | "2x1" | "2x2";
export type WidgetPreviewType =
  | "card"
  | "timer"
  | "forecast"
  | "streak"
  | "heatmap"
  | "quote"
  | "game";

export interface WidgetProps {
  className?: string;
  enableDrag?: boolean;
  enableResize?: boolean;
}

export interface Widget {
  id: string;
  name: string;
  category: WidgetCategory;
  size: WidgetSize;
  description: string;
  icon: string | React.ComponentType<{ className?: string }>;
  badge?: string;
  previewType: WidgetPreviewType;
  /** 渲染该小组件主体的 React 组件 */
  component: React.ComponentType<WidgetProps> | React.FC<WidgetProps>;
}
