/**
 * settings.ts - Reasonix Anki 用户配置状态存储（自动持久化）
 */
import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "oled" | "system";

export interface AppSettings {
  // 基础外观 & 主题（Modrinth/Axolotl 规范）
  themeMode: ThemeMode; // dark / light / oled / system
  customAccentColor: string; // 自定义强调色 Hex/HSL
  useCustomAccent: boolean;
  backgroundBlur: number; // 0 - 20px
  enableGlassBackground: boolean; // 自定义透明毛玻璃背景
  enableAdvancedRendering: boolean; // 启用模糊效果等高级渲染
  nativeWindowDecorations: boolean; // 原生窗口装饰
  minimizeToTray: boolean; // 最小化到系统托盘
  smoothPageTransitions: boolean; // 页面过渡动效
  sidebarCollapsedDefault: boolean; // 默认收起侧栏
  hideNameplate: boolean; // 隐藏用户标牌
  landingPage: "browse" | "review" | "galaxy" | "stats"; // 默认着陆页
  homeLayout: "dashboard" | "minimal"; // 主页布局风格
  autoHideDownloadBtn: boolean; // 自动隐藏下载按钮
  developerMode: boolean; // 开发者模式（点 5 次美西螈开启）

  // 语言 & 翻译 & AI (Beta)
  language: string; // zh-CN, en-US, ja-JP...
  autoTranslateCard: boolean; // 遇到生词自动划词翻译
  translationEngine: "deepseek" | "google" | "builtin";
  aiAssistantModel: "gemini-flash" | "gemini-pro" | "local";
  aiApiKey: string;
  aiPromptTemplate: string;

  // Anki 实例 & 资源调度
  ankiConnectHost: string;
  ankiConnectPort: number;
  ankiApiKey: string;
  autoSyncOnStart: boolean;
  maxMemoryCacheMB: number; // 资源管理内存上限 (MB)
  maxMediaConcurrentFetch: number; // 媒体并发加载数
  multiplayerP2PShare: boolean; // 多人联机牌组共享/实时自习室
  autoCheckUpdates: boolean; // 自动检测更新

  // 外观微调
  cardFontSizePercent: number; // 90, 100, 115, 130
  enableAudioVisualizer: boolean;
  reduceMotion: boolean;

  // 复习与调度
  maxSessionQueue: number; // 50 - 500
  autoPlayAudio: boolean;
  enableScriptMode: boolean; // 是否允许 iframe 运行自定义 JavaScript
  showAnswerTimer: boolean;

  // 知识星系
  galaxyQuality: "high" | "balanced" | "low";
  galaxyGlowEffect: boolean;
  galaxyDefaultRetention: number; // 80 - 97%
  galaxyAutoRotate: boolean;

  // 统计与热力图 (Stats & Heatmap Fluid Effect)
  heatmapStyle: "fluid" | "classic"; // "fluid" 流体注水 | "classic" 经典方格
  heatmapClassicWaveReveal: boolean; // 经典方格模式：波浪式揭示 (Wave-like Reveal) 动画
  heatmapTheme: "emerald" | "amber" | "ocean" | "aurora" | "amethyst" | "crimson" | "sunset" | "graphite";
  heatmapWaveEffect: boolean; // 流水波动注水动效
  heatmapTargetDaily: number; // 满水基准目标 (10-100张/天)
  heatmapWaveSpeed: "slow" | "normal" | "fast"; // 水流波动速率
  heatmapShowDayNumber: boolean; // 是否在网格中显示日期数字

  // 多选列表项（Checkbox 典型应用场景）
  multiSelectCardTypes: string[]; // 检索与统计包含卡片类型 ["new", "learn", "review", "buried"]
  multiSelectReviewShortcuts: string[]; // 启用复习快捷键列表 ["space_reveal", "num_rating", "bury_shortcut", "undo_shortcut", "auto_focus"]
  multiSelectGalaxyElements: string[]; // 知识星系图谱渲染层级 ["core_nodes", "gravity_orbits", "lapse_particles", "tag_nebulae"]
  multiSelectDataBackups: string[]; // 数据同步与导出项目 ["decks_schema", "revlog_history", "media_audio", "retention_stats"]

  // 实验性 Feature Flags
  flagExperimentalAudioGraph: boolean;
  flagWebGL2ComputeShader: boolean;
  flagDirectSQLiteBridge: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: "dark",
  customAccentColor: "#E11D48",
  useCustomAccent: false,
  backgroundBlur: 12,
  enableGlassBackground: false,
  enableAdvancedRendering: true,
  nativeWindowDecorations: false,
  minimizeToTray: true,
  smoothPageTransitions: true,
  sidebarCollapsedDefault: false,
  hideNameplate: false,
  landingPage: "browse",
  homeLayout: "dashboard",
  autoHideDownloadBtn: true,
  developerMode: false,

  language: "zh-CN",
  autoTranslateCard: false,
  translationEngine: "deepseek",
  aiAssistantModel: "gemini-flash",
  aiApiKey: "",
  aiPromptTemplate: "请将该单词或句子的语法点拆解，并生成 2 个生动的原声音频例句",

  ankiConnectHost: "127.0.0.1",
  ankiConnectPort: 8765,
  ankiApiKey: "",
  autoSyncOnStart: false,
  maxMemoryCacheMB: 512,
  maxMediaConcurrentFetch: 6,
  multiplayerP2PShare: false,
  autoCheckUpdates: true,

  cardFontSizePercent: 100,
  enableAudioVisualizer: true,
  reduceMotion: false,

  maxSessionQueue: 300,
  autoPlayAudio: true,
  enableScriptMode: false,
  showAnswerTimer: true,

  galaxyQuality: "high",
  galaxyGlowEffect: true,
  galaxyDefaultRetention: 90,
  galaxyAutoRotate: true,

  heatmapStyle: "fluid",
  heatmapClassicWaveReveal: true,
  heatmapTheme: "emerald",
  heatmapWaveEffect: true,
  heatmapTargetDaily: 30,
  heatmapWaveSpeed: "normal",
  heatmapShowDayNumber: false,

  multiSelectCardTypes: ["new", "learn", "review"],
  multiSelectReviewShortcuts: ["space_reveal", "num_rating", "bury_shortcut", "undo_shortcut", "auto_focus"],
  multiSelectGalaxyElements: ["core_nodes", "gravity_orbits", "lapse_particles", "tag_nebulae"],
  multiSelectDataBackups: ["decks_schema", "revlog_history", "media_audio", "retention_stats"],

  flagExperimentalAudioGraph: false,
  flagWebGL2ComputeShader: false,
  flagDirectSQLiteBridge: false,
};

const STORAGE_KEY = "ra.settings.v1";

function loadInitialSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsState {
  settings: AppSettings;
  settingsModalOpen: boolean;
  activeModalTab: string;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  openSettingsModal: (defaultTab?: string) => void;
  closeSettingsModal: () => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: loadInitialSettings(),
  settingsModalOpen: false,
  activeModalTab: "appearance",

  openSettingsModal: (defaultTab = "appearance") =>
    set({ settingsModalOpen: true, activeModalTab: defaultTab }),

  closeSettingsModal: () => set({ settingsModalOpen: false }),

  updateSetting: (key, value) =>
    set((state) => {
      const next = { ...state.settings, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn("Failed to persist settings:", err);
      }
      return { settings: next };
    }),

  updateSettings: (partial) =>
    set((state) => {
      const next = { ...state.settings, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn("Failed to persist settings:", err);
      }
      return { settings: next };
    }),

  resetToDefaults: () =>
    set(() => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.warn("Failed to remove settings:", err);
      }
      return { settings: DEFAULT_SETTINGS };
    }),
}));
