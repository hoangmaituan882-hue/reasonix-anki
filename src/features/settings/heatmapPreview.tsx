/**
 * 设置页热力图预览构件（从 v1 StatsView 抽取，不动主项目 StatsView）。
 * 依赖 CSS：rx-wave-crest / rx-wave-crest-back 动画（见 index.css）。
 */
import React from "react";

export type HeatmapThemeId =
  | "emerald"
  | "amber"
  | "ocean"
  | "aurora"
  | "amethyst"
  | "crimson"
  | "sunset"
  | "graphite";

export interface HeatmapThemeConfig {
  id: HeatmapThemeId;
  name: string;
  emoji: string;
  previewColor: string;
  colors: [string, string, string, string, string]; // 0%, 25%, 50%, 75%, 100% 静态色阶
  liquidGrad: string; // 流体渐变色
  waveColor: string; // 前景主水波颜色
  waveBack: string; // 背景副水波颜色
  glow: string; // 满水溢出辉光
}

export const HEATMAP_THEMES: Record<HeatmapThemeId, HeatmapThemeConfig> = {
  emerald: {
    id: "emerald",
    name: "翡翠流光",
    emoji: "🌿",
    previewColor: "#10b981",
    colors: ["var(--rx-bg-soft)", "#A7F3D0", "#34D399", "#10B981", "#047857"],
    liquidGrad: "linear-gradient(180deg, #10b981 0%, #047857 100%)",
    waveColor: "#10b981",
    waveBack: "#a7f3d0",
    glow: "rgba(16, 185, 129, 0.45)",
  },
  amber: {
    id: "amber",
    name: "熔岩琥珀",
    emoji: "🍯",
    previewColor: "#f59e0b",
    colors: ["var(--rx-bg-soft)", "#FEF3C7", "#FBBF24", "#F59E0B", "#B45309"],
    liquidGrad: "linear-gradient(180deg, #d97706 0%, #b45309 100%)",
    waveColor: "#d97706",
    waveBack: "#fde68a",
    glow: "rgba(245, 158, 11, 0.45)",
  },
  ocean: {
    id: "ocean",
    name: "蔚蓝深海",
    emoji: "🌊",
    previewColor: "#0284c7",
    colors: ["var(--rx-bg-soft)", "#BAE6FD", "#38BDF8", "#0284C7", "#0369A1"],
    liquidGrad: "linear-gradient(180deg, #0284c7 0%, #0369a1 100%)",
    waveColor: "#0284c7",
    waveBack: "#bae6fd",
    glow: "rgba(2, 132, 199, 0.45)",
  },
  aurora: {
    id: "aurora",
    name: "赛博极光",
    emoji: "⚡",
    previewColor: "#14b8a6",
    colors: ["var(--rx-bg-soft)", "#CCFBF1", "#2DD4BF", "#0D9488", "#115E59"],
    liquidGrad: "linear-gradient(180deg, #0d9488 0%, #115e59 100%)",
    waveColor: "#0d9488",
    waveBack: "#99f6e4",
    glow: "rgba(45, 212, 191, 0.5)",
  },
  amethyst: {
    id: "amethyst",
    name: "幻紫星云",
    emoji: "🌌",
    previewColor: "#9333ea",
    colors: ["var(--rx-bg-soft)", "#E9D5FF", "#C084FC", "#9333EA", "#6B21A8"],
    liquidGrad: "linear-gradient(180deg, #9333ea 0%, #6b21a8 100%)",
    waveColor: "#9333ea",
    waveBack: "#e9d5ff",
    glow: "rgba(147, 51, 234, 0.45)",
  },
  crimson: {
    id: "crimson",
    name: "炽热熔岩",
    emoji: "🔥",
    previewColor: "#e11d48",
    colors: ["var(--rx-bg-soft)", "#FECDD3", "#FB7185", "#E11D48", "#9F1239"],
    liquidGrad: "linear-gradient(180deg, #e11d48 0%, #9f1239 100%)",
    waveColor: "#e11d48",
    waveBack: "#fecdd3",
    glow: "rgba(225, 29, 72, 0.45)",
  },
  sunset: {
    id: "sunset",
    name: "暮光晚霞",
    emoji: "🌅",
    previewColor: "#f43f5e",
    colors: ["var(--rx-bg-soft)", "#FED7AA", "#FB923C", "#F43F5E", "#9D174D"],
    liquidGrad: "linear-gradient(180deg, #ea580c 0%, #be185d 100%)",
    waveColor: "#e11d48",
    waveBack: "#fed7aa",
    glow: "rgba(244, 63, 94, 0.45)",
  },
  graphite: {
    id: "graphite",
    name: "极简黑曜",
    emoji: "🖤",
    previewColor: "#475569",
    colors: ["var(--rx-bg-soft)", "#E2E8F0", "#94A3B8", "#475569", "#0F172A"],
    liquidGrad: "linear-gradient(180deg, #334155 0%, #0f172a 100%)",
    waveColor: "#334155",
    waveBack: "#cbd5e1",
    glow: "rgba(100, 116, 139, 0.45)",
  },
};

/* ---------------- 统一的两条动态起伏波浪线组件 ---------------- */

export function FluidWaveWaterLines({
  waveColor,
  waveBack,
  speedSec = "3s",
}: {
  waveColor: string;
  waveBack: string;
  speedSec?: string;
}) {
  return (
    <div className="absolute -top-1.5 inset-x-0 h-3 pointer-events-none overflow-visible">
      {/* 浅色上层波浪线（紧贴水面，略高于深色波，错相流动） */}
      <svg
        viewBox="0 0 200 20"
        preserveAspectRatio="none"
        className="absolute top-0 left-0 w-[200%] h-full rx-wave-crest-back"
        style={{ "--wave-speed": speedSec } as React.CSSProperties}
      >
        <path
          d="M 0 7 Q 12.5 5, 25 7 T 50 7 T 75 7 T 100 7 T 125 7 T 150 7 T 175 7 T 200 7 L 200 20 L 0 20 Z"
          fill={waveBack}
        />
      </svg>

      {/* 深色下层波浪线（深浓主色，紧随浅色波下方，平缓交错） */}
      <svg
        viewBox="0 0 200 20"
        preserveAspectRatio="none"
        className="absolute top-0 left-0 w-[200%] h-full rx-wave-crest"
        style={{ "--wave-speed": speedSec } as React.CSSProperties}
      >
        <path
          d="M 0 11 Q 12.5 13, 25 11 T 50 11 T 75 11 T 100 11 T 125 11 T 150 11 T 175 11 T 200 11 L 200 20 L 0 20 Z"
          fill={waveColor}
        />
      </svg>
    </div>
  );
}
