import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ExternalLink,
  Code2,
  Cpu,
  Database,
  Layers,
  ShieldCheck,
  Activity,
  Copy,
  Waves,
  Droplets,
  X,
  Check,
  Trash2,
  Key,
} from "lucide-react";
import {
  AnimatedAlertCircle,
  AnimatedBot,
  AnimatedCheckCircle2,
  AnimatedGraduationCap,
  AnimatedHardDrive,
  AnimatedInfo,
  AnimatedLanguages,
  AnimatedOrbit,
  AnimatedPaintbrush,
  AnimatedPlug,
  AnimatedPuzzle,
  AnimatedRefreshCw,
  AnimatedRotateCw,
  AnimatedSave,
  AnimatedSliders,
  AnimatedSparkles,
  AnimatedTrendingUp,
} from "./icons/animated";
import { Badge, Button, Input, Skeleton, cn } from "@reasonix/ui";
import { useSettingsStore } from "../stores/settings";
import { useAppStore } from "../stores/app";
import { useAnkiConnection } from "../lib/anki/useConnection";
import { inTauri } from "../lib/anki/transport";
import { openSettingsWindow } from "../lib/window";
import { toast, toastError } from "./ToasterLite";
import { PluginSyncCard } from "./PluginSyncCard";
import { DiagnosticsCard } from "./DiagnosticsCard";
import { AboutCard } from "./AboutCard";
import { anki } from "../lib/anki/actions";
import {
  HEATMAP_THEMES,
  FluidWaveWaterLines,
  type HeatmapThemeId,
} from "../features/settings/heatmapPreview";
import {
  Checkbox,
  CheckboxGroup,
  ToggleRow,
  Slider,
  SliderRow,
} from "./SettingsControls";

// 预设强调色板（Reasonix 鲜艳流行色系）
const ACCENT_PRESETS = [
  { name: "胭脂绯红", hex: "#E11D48" },
  { name: "极光青翠", hex: "#10B981" },
  { name: "海沫蔚蓝", hex: "#0284C7" },
  { name: "星辉紫罗兰", hex: "#8B5CF6" },
  { name: "琥珀暖橙", hex: "#F59E0B" },
  { name: "玄铁深灰", hex: "#71717A" },
];

function ModalTabButton({
  tab,
  isSelected,
  onClick,
}: {
  tab: {
    id: string;
    label: string;
    subLabel: string;
    icon: React.ComponentType<any>;
    beta?: boolean;
  };
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(0);
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        setClicked((c) => c + 1);
        onClick();
      }}
      className={cn(
        "group relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-body-sm font-medium transition-all rx-press active:scale-[0.97]",
        isSelected
          ? "bg-[#E11D48] text-white shadow-xs font-bold"
          : "text-[var(--rx-fg-dim)] hover:bg-[var(--rx-sidebar-hover)] hover:text-[var(--rx-fg)]"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon
          size={16}
          isHovered={hovered}
          trigger={clicked}
          className={cn(
            "shrink-0",
            isSelected ? "text-white" : "text-[var(--rx-fg-faint)] group-hover:text-[var(--rx-fg)]"
          )}
        />
        <span className="truncate">{tab.label}</span>
      </div>

      {tab.beta && (
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-micro-xxs font-bold shrink-0 tracking-tight",
            isSelected
              ? "bg-white/20 text-white"
              : "bg-[#E11D48]/15 text-[#E11D48] dark:bg-[#E11D48]/25 dark:text-[#FDA4AF]"
          )}
        >
          测试版
        </span>
      )}
    </button>
  );
}

function ModalLogoButton({
  developerMode,
  onClick,
}: {
  developerMode: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(0);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        setClicked((c) => c + 1);
        onClick();
      }}
      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[var(--rx-sidebar-hover)] cursor-pointer transition-all rx-press select-none"
      title={developerMode ? "开发者模式已激活" : "连续点击 5 次开启开发者选项"}
    >
      <div className="h-8 w-8 rounded-lg bg-[var(--rx-accent-soft)] border border-[var(--rx-accent)]/20 flex items-center justify-center text-[var(--rx-accent)] shrink-0 shadow-2xs">
        <AnimatedGraduationCap size={16} isHovered={hovered} trigger={clicked} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-caption-xs font-bold text-[var(--rx-fg)] truncate flex items-center gap-1">
          <span>Reasonix Anki</span>
          {developerMode && (
            <span className="text-micro-xxs px-1 py-0.2 rounded bg-amber-500/20 text-amber-500 font-mono">
              DEV
            </span>
          )}
        </div>
        <div className="text-micro-xxs text-[var(--rx-fg-faint)] font-mono truncate">
          v0.1.0 · {inTauri ? "Desktop App" : "Web Preview"}
        </div>
      </div>
    </div>
  );
}

export function AppSettingsModal() {
  const {
    settingsModalOpen,
    closeSettingsModal,
    activeModalTab,
    updateSetting,
    updateSettings,
    settings,
  } = useSettingsStore();

  const { dark, toggleDark } = useAppStore();
  const connection = useAnkiConnection();

  const [currentTab, setCurrentTab] = useState(activeModalTab || "connection");
  const [logoClickCount, setLogoClickCount] = useState(0);

  // AnkiConnect 临时表单状态
  const [hostInput, setHostInput] = useState(settings.ankiConnectHost);
  const [portInput, setPortInput] = useState(String(settings.ankiConnectPort));
  const [apiKeyInput, setApiKeyInput] = useState(settings.ankiApiKey);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // 滚动渐变遮罩检测
  const contentRef = useRef<HTMLDivElement>(null);
  const [showTopMask, setShowTopMask] = useState(false);
  const [showBottomMask, setShowBottomMask] = useState(false);
  const [previewWaterLevel, setPreviewWaterLevel] = useState(65);
  const [wavePreviewKey, setWavePreviewKey] = useState(0);

  // 当外部指定 activeModalTab 或打开弹窗时同步状态
  useEffect(() => {
    if (activeModalTab) {
      setCurrentTab(activeModalTab);
    }
    setHostInput(settings.ankiConnectHost);
    setPortInput(String(settings.ankiConnectPort));
    setApiKeyInput(settings.ankiApiKey);
  }, [activeModalTab, settingsModalOpen, settings.ankiConnectHost, settings.ankiConnectPort, settings.ankiApiKey]);

  // 检测内容滚动状态，呈现顶部/底部平滑遮罩
  const checkScrollMasks = () => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShowTopMask(scrollTop > 8);
    setShowBottomMask(scrollTop + clientHeight < scrollHeight - 8);
  };

  useEffect(() => {
    if (settingsModalOpen) {
      checkScrollMasks();
      const timer = setTimeout(checkScrollMasks, 150);
      return () => clearTimeout(timer);
    }
  }, [settingsModalOpen, currentTab]);

  // 点击 5 次开启 Developer mode
  const handleLogoClick = () => {
    const next = logoClickCount + 1;
    setLogoClickCount(next);
    if (next >= 5) {
      if (!settings.developerMode) {
        updateSetting("developerMode", true);
        toast({
          title: "🎉 开发者模式已解锁！",
          description: "左侧已显示 Feature flags 实验性功能标签页。",
        });
      } else {
        toast({ title: "已处于开发者模式" });
      }
    }
  };

  // 保存连接配置
  const handleSaveConnection = () => {
    const portNum = parseInt(portInput.trim(), 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      toast({ title: "端口号必须在 1 ~ 65535 之间", variant: "destructive" });
      return;
    }

    updateSettings({
      ankiConnectHost: hostInput.trim() || "127.0.0.1",
      ankiConnectPort: portNum,
      ankiApiKey: apiKeyInput.trim(),
    });

    toast({ title: "连接配置已保存", variant: "default" });
    void connection.refetch();
  };

  // 测试 AnkiConnect
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const ver = await anki.version();
      setTestResult({
        success: true,
        message: `连接成功！AnkiConnect 版本: v${ver}`,
      });
      toast({ title: `连接成功 (AnkiConnect v${ver})`, variant: "default" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: `连接失败: ${msg}`,
      });
      toastError("测试连接失败", "请检查 Anki 是否已启动并开启 AnkiConnect 插件");
    } finally {
      setTestingConnection(false);
    }
  };

  // 立即同步 AnkiWeb
  const handleSyncAnkiWeb = async () => {
    setSyncing(true);
    try {
      await anki.sync();
      toast({ title: "AnkiWeb 云端数据同步完成", variant: "default" });
    } catch (err) {
      toastError("AnkiWeb 同步失败", err);
    } finally {
      setSyncing(false);
    }
  };

  // 清除本地缓存
  const handleClearCache = () => {
    try {
      const buriedKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("ra.buried.")) {
          buriedKeys.push(k);
        }
      }
      buriedKeys.forEach((k) => localStorage.removeItem(k));
      toast({ title: `已清理 ${buriedKeys.length} 条今日会话缓存`, variant: "default" });
    } catch (err) {
      toastError("清理缓存失败", err);
    }
  };

  // Tab 结构定义
  const TABS = [
    {
      id: "connection",
      label: "服务桥接",
      subLabel: "AnkiConnect",
      icon: AnimatedPlug,
      beta: false,
    },
    {
      id: "appearance",
      label: "外观主题",
      subLabel: "Appearance",
      icon: AnimatedPaintbrush,
      beta: false,
    },
    {
      id: "review",
      label: "复习调度",
      subLabel: "Review & Scheduling",
      icon: AnimatedGraduationCap,
      beta: false,
    },
    {
      id: "stats",
      label: "统计热力",
      subLabel: "Stats & Heatmap",
      icon: AnimatedTrendingUp,
      beta: false,
    },
    {
      id: "galaxy",
      label: "知识星系",
      subLabel: "Galaxy 3D",
      icon: AnimatedOrbit,
      beta: false,
    },
    {
      id: "ai",
      label: "AI 智学",
      subLabel: "AI Assistant",
      icon: AnimatedBot,
      beta: true,
      flushContent: true,
    },
    {
      id: "language",
      label: "语言翻译",
      subLabel: "Language & Translation",
      icon: AnimatedLanguages,
      beta: false,
    },
    {
      id: "resources",
      label: "存储缓存",
      subLabel: "Storage & Cache",
      icon: AnimatedHardDrive,
      beta: false,
    },
    {
      id: "updates",
      label: "应用更新",
      subLabel: "Updates",
      icon: AnimatedRefreshCw,
      beta: false,
    },
    {
      id: "about",
      label: "关于",
      subLabel: "About",
      icon: AnimatedInfo,
      beta: false,
    },
    {
      id: "plugins",
      label: "插件与同步",
      subLabel: "Addon & Sync",
      icon: AnimatedPuzzle,
      beta: false,
    },
    ...(settings.developerMode
      ? [
          {
            id: "flags",
            label: "Feature flags",
            subLabel: "开发者实验选项",
            icon: AnimatedSliders,
            beta: false,
          },
        ]
      : []),
  ];

  if (!settingsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩背景 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeSettingsModal}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-all"
      />

      {/* 模态框主体：宽 72rem (1152px) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col w-full max-w-[72rem] rounded-3xl bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] shadow-2xl overflow-hidden text-[var(--rx-fg)]"
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--rx-border-soft)] select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-[var(--rx-accent)] text-[var(--rx-accent-fg)] shadow-xs">
              <AnimatedSliders size={20} />
            </div>
            <div>
              <h1 className="heading-xl flex items-center gap-2">
                <span>系统设置</span>
                <span className="text-body-sm font-normal text-[var(--rx-fg-faint)]">
                  Reasonix Anki Settings
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                closeSettingsModal();
                void openSettingsWindow();
              }}
              className="text-caption-xs font-bold gap-1.5 rx-press"
              title="在独立桌面窗口中打开"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[var(--rx-accent)]" />
              独立窗口
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeSettingsModal}
              className="h-8 w-8 rounded-full hover:bg-[var(--rx-sidebar-hover)]"
              aria-label="关闭设置"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 左右分栏主体 */}
        <div className="flex min-h-[480px]">
          {/* 左栏：竖排标签导航（min-w-[200px]） + 1px border-divider */}
          <aside className="w-56 min-w-[200px] shrink-0 border-r border-[var(--rx-border-soft)] flex flex-col justify-between p-3 select-none bg-[var(--rx-bg-soft)]/30">
            {/* 标签列表 */}
            <nav className="space-y-1 overflow-y-auto max-h-[480px] pr-1" aria-label="设置标签">
              {TABS.map((tab) => (
                <ModalTabButton
                  key={`modal_tab_${tab.id}`}
                  tab={tab}
                  isSelected={currentTab === tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                />
              ))}
            </nav>

            {/* 页脚：Reasonix Anki Logo + 产品名 + 版本号 + 点 5 次开启 Developer mode */}
            <div className="pt-3 border-t border-[var(--rx-border-soft)]">
              <ModalLogoButton
                developerMode={!!settings.developerMode}
                onClick={handleLogoClick}
              />
            </div>
          </aside>

          {/* 右栏：内容区，高度上限 max-h-[min(65vh,600px)]，带顶部/底部渐变淡出遮罩 */}
          <div className="relative flex-1 flex flex-col min-w-0 bg-[var(--rx-bg)]">
            {/* 顶部淡出遮罩 */}
            <div
              className={cn(
                "pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[var(--rx-bg)] to-transparent z-10 transition-opacity duration-200",
                showTopMask ? "opacity-100" : "opacity-0"
              )}
            />

            {/* 可滚动内容面板 */}
            <div
              ref={contentRef}
              onScroll={checkScrollMasks}
              className="flex-1 overflow-y-auto max-h-[min(65vh,600px)] p-6 space-y-6"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  {/* TAB 1: AnkiConnect 服务桥接 */}
                  {currentTab === "connection" && (
                    <SectionBlock
                      title="AnkiConnect 服务桥接"
                      description="Reasonix Anki 通过 HTTP 协议与本地运行中的 Anki 实例通信"
                    >
                      <div className="space-y-4">
                        {/* 连通状态概览 */}
                        <div className="flex flex-wrap items-center justify-between gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-neutral-900/60 border border-[var(--rx-border-soft)]">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className={cn(
                                "h-11 w-11 rounded-xl flex items-center justify-center font-bold shrink-0",
                                connection.status === "connected"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                              )}
                            >
                              {connection.status === "connected" ? (
                                <AnimatedCheckCircle2 size={24} />
                              ) : (
                                <AnimatedAlertCircle size={24} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-body-nm font-bold flex items-center gap-2">
                                <span>
                                  {connection.status === "connected"
                                    ? "服务已连接"
                                    : connection.status === "checking"
                                    ? "正在检测连接..."
                                    : "未连接至 Anki"}
                                </span>
                                {(connection.version || connection.status === "connected") && (
                                  <Badge variant="outline" className="text-badge-xs font-mono">
                                    v{connection.version || 6}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-body-sm text-[var(--rx-fg-faint)] mt-0.5">
                                {connection.status === "connected"
                                  ? "AnkiConnect 插件运行正常，可实时同步读写卡片与调度数据"
                                  : connection.error || "请确保已在电脑上启动 Anki 并安装 AnkiConnect 插件"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleSyncAnkiWeb}
                              disabled={syncing}
                              className="text-body-sm font-bold gap-1.5 rx-press"
                            >
                              <AnimatedRefreshCw size={16} trigger={syncing} className={cn(syncing && "animate-spin")} />
                              AnkiWeb 同步
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleTestConnection}
                              disabled={testingConnection}
                              className="text-body-sm font-bold gap-1.5 rx-press"
                            >
                              <AnimatedRefreshCw size={16} trigger={testingConnection} className={cn(testingConnection && "animate-spin")} />
                              测试连通
                            </Button>
                          </div>
                        </div>

                        {/* 测试结果提示 */}
                        {testResult && (
                          <div
                            className={cn(
                              "p-3.5 rounded-xl text-body-sm font-medium flex items-center gap-2.5 border",
                              testResult.success
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                            )}
                          >
                            {testResult.success ? (
                              <AnimatedCheckCircle2 size={16} />
                            ) : (
                              <AnimatedAlertCircle size={16} />
                            )}
                            <span>{testResult.message}</span>
                          </div>
                        )}

                        {/* 主机与端口配置 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-body-sm font-bold text-[var(--rx-fg)]">
                              服务地址 (Host IP)
                            </label>
                            <Input
                              value={hostInput}
                              onChange={(e) => setHostInput(e.target.value)}
                              placeholder="127.0.0.1"
                              className="font-mono text-body-sm"
                            />
                            <p className="text-caption-xs text-[var(--rx-fg-faint)]">
                              默认本地单机 127.0.0.1，如连接局域网其他设备可填对应 IP
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-body-sm font-bold text-[var(--rx-fg)]">
                              端口号 (Port)
                            </label>
                            <Input
                              value={portInput}
                              onChange={(e) => setPortInput(e.target.value)}
                              placeholder="8765"
                              className="font-mono text-body-sm"
                            />
                            <p className="text-caption-xs text-[var(--rx-fg-faint)]">
                              AnkiConnect 默认 8765
                            </p>
                          </div>
                        </div>

                        {/* API Key 秘钥 */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-body-sm font-bold text-[var(--rx-fg)] flex items-center gap-1.5">
                            <Key className="h-4 w-4 text-[var(--rx-accent)]" />
                            <span>API Key 秘钥（可选）</span>
                          </label>
                          <Input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="若 AnkiConnect 开启了 apiKey 保护请填入"
                            className="font-mono text-body-sm"
                          />
                          <p className="text-caption-xs text-[var(--rx-fg-faint)]">
                            如果您的 AnkiConnect 配置文件配置了 'apiKey'，请在此输入对应令牌
                          </p>
                        </div>

                        <div className="flex justify-end pt-2">
                          <Button
                            size="sm"
                            onClick={handleSaveConnection}
                            className="text-body-sm font-bold gap-1.5 rx-press"
                          >
                            <AnimatedSave size={16} />
                            保存连接配置
                          </Button>
                        </div>
                      </div>
                    </SectionBlock>
                  )}

                  {/* TAB 2: 外观设置 */}
                  {currentTab === "appearance" && (
                    <>
                      {/* 1. 色彩主题 */}
                      <SectionBlock
                        title="色彩主题"
                        description="为 Reasonix Anki 工作台选择偏好的色彩主题与明暗模式。"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* 深色 */}
                          <ThemeCard
                            title="深色"
                            icon="☾"
                            selected={settings.themeMode === "dark" && dark}
                            onClick={() => {
                              updateSetting("themeMode", "dark");
                              if (!dark) toggleDark();
                            }}
                            previewClass="bg-[#18181B]"
                            barClass="bg-[#71717A]"
                            subBarClass="bg-[#52525B]"
                            itemClass="bg-[#27272A]"
                            pillClass="bg-[#3F3F46]"
                          />

                          {/* 浅色 */}
                          <ThemeCard
                            title="浅色"
                            icon="☼"
                            selected={settings.themeMode === "light" && !dark}
                            onClick={() => {
                              updateSetting("themeMode", "light");
                              if (dark) toggleDark();
                            }}
                            previewClass="bg-[#E4E4E7]"
                            barClass="bg-[#27272A]"
                            subBarClass="bg-[#52525B]"
                            itemClass="bg-[#F4F4F5]"
                            pillClass="bg-[#FFFFFF]"
                          />

                          {/* OLED 纯黑 */}
                          <ThemeCard
                            title="OLED"
                            icon="✦"
                            selected={settings.themeMode === "oled"}
                            onClick={() => {
                              updateSetting("themeMode", "oled");
                              if (!dark) toggleDark();
                            }}
                            previewClass="bg-[#000000]"
                            barClass="bg-[#94A3B8]"
                            subBarClass="bg-[#64748B]"
                            itemClass="bg-[#111113]"
                            pillClass="bg-[#1E293B]"
                          />

                          {/* 跟随系统 */}
                          <ThemeCard
                            title="系统"
                            icon="💻"
                            selected={settings.themeMode === "system"}
                            onClick={() => updateSetting("themeMode", "system")}
                            previewClass="bg-[#E5E7EB]"
                            barClass="bg-[#1F2937]"
                            subBarClass="bg-[#4B5563]"
                            itemClass="bg-[#F9FAFB]"
                            pillClass="bg-[#FFFFFF]"
                          />
                        </div>
                      </SectionBlock>

                      {/* 2. 强调色 */}
                      <SectionBlock
                        title="强调色"
                        description="选择用于按钮、选中状态和高亮元素的颜色。"
                      >
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            {ACCENT_PRESETS.map((preset) => {
                              const isSelected =
                                !settings.useCustomAccent &&
                                settings.customAccentColor.toLowerCase() ===
                                  preset.hex.toLowerCase();
                              return (
                                <button
                                  key={`accent_preset_${preset.hex}`}
                                  type="button"
                                  onClick={() => {
                                    updateSettings({
                                      customAccentColor: preset.hex,
                                      useCustomAccent: false,
                                    });
                                  }}
                                  className={cn(
                                    "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all rx-press",
                                    isSelected
                                      ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 shadow-xs ring-2 ring-[var(--rx-accent)]/30"
                                      : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                                  )}
                                >
                                  <span
                                    className="h-7 w-7 rounded-full shadow-xs flex items-center justify-center text-white text-xs font-bold"
                                    style={{ backgroundColor: preset.hex }}
                                  >
                                    {isSelected && <Check className="h-4 w-4" />}
                                  </span>
                                  <span className="text-xs font-medium text-[var(--rx-fg-dim)] truncate">
                                    {preset.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* 自定义色板 HSL / Hex */}
                          <div className="p-4 rounded-2xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/40 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">自定义强调色</span>
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-5 w-5 rounded-full border border-white/20 shadow-xs"
                                  style={{ backgroundColor: settings.customAccentColor }}
                                />
                                <Input
                                  value={settings.customAccentColor}
                                  onChange={(e) => {
                                    updateSettings({
                                      customAccentColor: e.target.value,
                                      useCustomAccent: true,
                                    });
                                  }}
                                  placeholder="#E11D48"
                                  className="w-28 font-mono text-xs h-8"
                                />
                              </div>
                            </div>

                            {/* 色相滑块 */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-caption-xs text-[var(--rx-fg-faint)]">
                                <span>HSL 色相调节 (Hue)</span>
                                <span>实时响应</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={360}
                                defaultValue={345}
                                onChange={(e) => {
                                  const hex = hslToHex(Number(e.target.value), 80, 50);
                                  updateSettings({
                                    customAccentColor: hex,
                                    useCustomAccent: true,
                                  });
                                }}
                                className="w-full h-2.5 rounded-lg appearance-none cursor-pointer"
                                style={{
                                  background:
                                    "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </SectionBlock>

                      {/* 3. 界面微调开关项 */}
                      <SectionBlock
                        title="外观与渲染设置"
                        description="针对桌面启动器与工作台窗口渲染性能与界面动效的深度微调。"
                      >
                        <div className="divide-y divide-[var(--rx-border-soft)]">
                          <ToggleRow
                            title="透明背景"
                            description="让桌面透过启动器窗口显示出来。"
                            checked={settings.enableGlassBackground}
                            onChange={(v) => updateSetting("enableGlassBackground", v)}
                          />

                          <ToggleRow
                            title="高级渲染"
                            description="启用模糊效果等高级渲染。"
                            checked={settings.enableAdvancedRendering}
                            onChange={(v) => updateSetting("enableAdvancedRendering", v)}
                          />

                          <ToggleRow
                            title="页面切换过渡动画"
                            description="在视图与页面切换时启用平滑淡入淡出过渡动效。"
                            checked={settings.smoothPageTransitions}
                            onChange={(v) => updateSetting("smoothPageTransitions", v)}
                          />

                          <ToggleRow
                            title="原生窗口装饰"
                            description="禁用自定义自绘标题栏，改用 Windows/macOS 原生边框。"
                            checked={settings.nativeWindowDecorations}
                            onChange={(v) => updateSetting("nativeWindowDecorations", v)}
                          />

                          <ToggleRow
                            title="关闭时最小化到系统托盘"
                            description="点击右上角关闭按钮时保持后台运行，随时按快捷键唤醒。"
                            checked={settings.minimizeToTray}
                            onChange={(v) => updateSetting("minimizeToTray", v)}
                          />

                          <ToggleRow
                            title="默认收起左侧导航栏"
                            description="启动工作台时默认以极简窄栏模式展示。"
                            checked={settings.sidebarCollapsedDefault}
                            onChange={(v) => updateSetting("sidebarCollapsedDefault", v)}
                          />
                        </div>
                      </SectionBlock>
                    </>
                  )}

                  {/* TAB 3: 复习与调度 */}
                  {currentTab === "review" && (
                    <>
                      <SectionBlock
                        title="复习与调度偏好"
                        description="配置卡片调度策略、单次队列上限与动态模板执行权限。"
                      >
                        <div className="space-y-4">
                          <SliderRow
                            label="复习队列单次上限"
                            value={settings.maxSessionQueue}
                            min={50}
                            max={500}
                            step={25}
                            unit="张卡"
                            onValueChange={(v) => updateSetting("maxSessionQueue", v)}
                          />

                          <div className="divide-y divide-[var(--rx-border-soft)]">
                            <ToggleRow
                              title="自动播放媒体发音"
                              description="进入卡片问题或答案面时自动播放 [sound:] 媒体音频。"
                              checked={settings.autoPlayAudio}
                              onChange={(v) => updateSetting("autoPlayAudio", v)}
                            />

                            <ToggleRow
                              title="脚本模式 (Script Mode)"
                              description="允许复杂动态卡片模板执行 JavaScript 交互代码（适合 Mining 重模板）。"
                              checked={settings.enableScriptMode}
                              onChange={(v) => updateSetting("enableScriptMode", v)}
                            />

                            <ToggleRow
                              title="显示作答计时器"
                              description="在复习底栏显示当前卡片的思考与答题耗时。"
                              checked={settings.showAnswerTimer}
                              onChange={(v) => updateSetting("showAnswerTimer", v)}
                            />
                          </div>
                        </div>
                      </SectionBlock>

                      {/* 多选列表 1: 复习快捷键（方块在左，文字在右） */}
                      <SectionBlock
                        title="复习快捷键与按键行为"
                        description="选择并启用复习会话期间支持的键盘操作快捷指令（支持多选列表勾选）。"
                      >
                        <CheckboxGroup
                          title="启用快捷键清单"
                          description="方块统一在左对齐，便于快速扫视启用状态"
                        >
                          {[
                            {
                              id: "space_reveal",
                              label: "空格键直接翻面 (Space)",
                              description: "在问题面敲击空格直接翻转显示答案面。",
                            },
                            {
                              id: "num_rating",
                              label: "数字键 1-4 快速评分",
                              description: "1=重来(Again)、2=困难(Hard)、3=良好(Good)、4=简单(Easy)。",
                            },
                            {
                              id: "bury_shortcut",
                              label: "'B' 键快捷暂存/埋没当前卡片 (Bury)",
                              description: "本次会话内推迟该卡，无任何 Anki 调度副作用。",
                            },
                            {
                              id: "undo_shortcut",
                              label: "'Z' / Ctrl+Z 允许撤销上一张评分",
                              description: "答错或误触时快速回退到上一个卡片位置。",
                            },
                            {
                              id: "auto_focus",
                              label: "翻面或评分后光标自动聚焦卡片沙箱",
                              description: "确保键盘事件直接响应，无需再次点击页面。",
                            },
                          ].map((item) => {
                            const isChecked = (settings.multiSelectReviewShortcuts || []).includes(
                              item.id
                            );
                            return (
                              <Checkbox
                                key={`shortcut_${item.id}`}
                                checked={isChecked}
                                onChange={(nextChecked) => {
                                  const current = settings.multiSelectReviewShortcuts || [];
                                  const updated = nextChecked
                                    ? [...current, item.id]
                                    : current.filter((id) => id !== item.id);
                                  updateSetting("multiSelectReviewShortcuts", updated);
                                }}
                                label={item.label}
                                description={item.description}
                              />
                            );
                          })}
                        </CheckboxGroup>
                      </SectionBlock>

                      {/* 多选列表 2: 检索与统计包含卡片类型（方块在左，文字在右） */}
                      <SectionBlock
                        title="卡片筛选与统计队列口径"
                        description="勾选统计概览与复习队列默认包含的卡片状态范围。"
                      >
                        <CheckboxGroup
                          title="包含卡片类型"
                          description="多选配置生效于卡片检索与概览统计"
                        >
                          {[
                            {
                              id: "new",
                              label: "未学习的新卡 (New Cards)",
                              description: "尚未建立记忆连接的全新词条。",
                            },
                            {
                              id: "learn",
                              label: "学习与重学中卡片 (Learning / Relearning)",
                              description: "正在阶段间隔内反复巩固的卡片。",
                            },
                            {
                              id: "review",
                              label: "已到期复习卡片 (Review Cards)",
                              description: "根据间隔重复算法已到期的常态复习卡片。",
                            },
                            {
                              id: "buried",
                              label: "暂存与埋没卡片 (Buried / Suspended)",
                              description: "已被用户手动暂停或今日埋没的卡片。",
                            },
                          ].map((item) => {
                            const isChecked = (settings.multiSelectCardTypes || []).includes(item.id);
                            return (
                              <Checkbox
                                key={`card_type_${item.id}`}
                                checked={isChecked}
                                onChange={(nextChecked) => {
                                  const current = settings.multiSelectCardTypes || [];
                                  const updated = nextChecked
                                    ? [...current, item.id]
                                    : current.filter((id) => id !== item.id);
                                  updateSetting("multiSelectCardTypes", updated);
                                }}
                                label={item.label}
                                description={item.description}
                              />
                            );
                          })}
                        </CheckboxGroup>
                      </SectionBlock>
                    </>
                  )}

                  {/* TAB: 统计与热力图 */}
                  {currentTab === "stats" && (
                    <>
                      {/* 0. 热力图渲染风格模式 */}
                      <SectionBlock
                        title="热力图渲染模式"
                        description="选择现代动态流体注水效果，或保持与之前一样的经典纯色阶方格。"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* 流体注水模式 */}
                          <button
                            type="button"
                            onClick={() => updateSetting("heatmapStyle", "fluid")}
                            className={cn(
                              "flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all rx-press relative overflow-hidden",
                              settings.heatmapStyle !== "classic"
                                ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 shadow-xs ring-2 ring-[var(--rx-accent)]/30"
                                : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                            )}
                          >
                            <div className="flex items-center justify-between w-full mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-500 font-bold">
                                  <Waves className="h-4 w-4" />
                                </span>
                                <div>
                                  <div className="text-body-sm font-bold">现代流体注水模式</div>
                                  <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                                    杯体注水、双层流动波浪与满水溢光
                                  </div>
                                </div>
                              </div>
                              {settings.heatmapStyle !== "classic" && (
                                <AnimatedCheckCircle2 size={16} />
                              )}
                            </div>
                            <div className="w-full flex items-center gap-1.5 mt-2 p-1.5 rounded-xl bg-[var(--rx-bg-soft)]/60 border border-[var(--rx-border-soft)]">
                              <div className="text-micro-xxs font-mono text-[var(--rx-fg-faint)]">预览:</div>
                              {[20, 50, 80, 100].map((fill, i) => (
                                <div
                                  key={i}
                                  className="h-5 flex-1 rounded-md bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] relative overflow-hidden"
                                >
                                  <div
                                    className="absolute inset-x-0 bottom-0 bg-emerald-500"
                                    style={{ height: `${fill}%` }}
                                  />
                                </div>
                              ))}
                            </div>
                          </button>

                          {/* 经典纯色方格模式 */}
                          <button
                            type="button"
                            onClick={() => updateSetting("heatmapStyle", "classic")}
                            className={cn(
                              "flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all rx-press relative overflow-hidden",
                              settings.heatmapStyle === "classic"
                                ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 shadow-xs ring-2 ring-[var(--rx-accent)]/30"
                                : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                            )}
                          >
                            <div className="flex items-center justify-between w-full mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold">
                                  <Layers className="h-4 w-4" />
                                </span>
                                <div>
                                  <div className="text-body-sm font-bold">经典纯色方格模式</div>
                                  <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                                    GitHub / Anki 原生经典纯色阶方块
                                  </div>
                                </div>
                              </div>
                              {settings.heatmapStyle === "classic" && (
                                <AnimatedCheckCircle2 size={16} />
                              )}
                            </div>
                            <div className="w-full flex items-center gap-1.5 mt-2 p-1.5 rounded-xl bg-[var(--rx-bg-soft)]/60 border border-[var(--rx-border-soft)]">
                              <div className="text-micro-xxs font-mono text-[var(--rx-fg-faint)]">预览:</div>
                              {["#A7F3D0", "#34D399", "#10B981", "#047857"].map((c, i) => (
                                <div
                                  key={i}
                                  className="h-5 flex-1 rounded-md border border-black/10 dark:border-white/10"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </button>
                        </div>
                      </SectionBlock>

                      {/* 1. 8 大热力图主题 */}
                      <SectionBlock
                        title={
                          settings.heatmapStyle === "classic"
                            ? "经典方格色彩主题"
                            : "流体热力图色系"
                        }
                        description={
                          settings.heatmapStyle === "classic"
                            ? "选择统计概览经典纯色阶方格的色彩基调与 5 阶调色板。"
                            : "选择统计概览热力图的色彩基调与动态注水流体配色。"
                        }
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {Object.values(HEATMAP_THEMES).map((theme) => {
                            const isSelected = settings.heatmapTheme === theme.id;
                            return (
                              <button
                                key={`settings_modal_theme_${theme.id}`}
                                type="button"
                                onClick={() => updateSetting("heatmapTheme", theme.id)}
                                className={cn(
                                  "flex flex-col items-start p-3 rounded-2xl border text-left transition-all rx-press relative overflow-hidden",
                                  isSelected
                                    ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 shadow-xs ring-2 ring-[var(--rx-accent)]/30"
                                    : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                                )}
                              >
                                <div className="flex items-center justify-between w-full mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{theme.emoji}</span>
                                    <span className="text-body-sm font-bold">{theme.name}</span>
                                  </div>
                                  {isSelected && (
                                    <AnimatedCheckCircle2 size={16} />
                                  )}
                                </div>
                                {/* 色阶条 */}
                                <div className="flex items-center gap-1 w-full mt-1">
                                  {theme.colors.map((c, i) => (
                                    <span
                                      key={i}
                                      className="h-3 flex-1 rounded-sm border border-black/10 dark:border-white/10"
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </SectionBlock>

                      {/* 流体模式专属设置 */}
                      {settings.heatmapStyle !== "classic" && (
                        <>
                          {/* 2. 流体动效与注水参数 */}
                          <SectionBlock
                            title="流水波动与注水机制"
                            description="当复习卡片越多时，方格水位线越高，波浪如流水般荡漾直到填满。"
                          >
                            <div className="space-y-4">
                              <div className="divide-y divide-[var(--rx-border-soft)]">
                                <ToggleRow
                                  title="开启流体波浪注水动效"
                                  description="方格随学习量上涨形成水面波动，满水时激发溢光脉冲。"
                                  checked={settings.heatmapWaveEffect}
                                  onChange={(v) => updateSetting("heatmapWaveEffect", v)}
                                />

                                <ToggleRow
                                  title="显示方格公历日期"
                                  description="在每个热力格中心显示当前公历日期数字。"
                                  checked={settings.heatmapShowDayNumber}
                                  onChange={(v) => updateSetting("heatmapShowDayNumber", v)}
                                />
                              </div>

                              {/* 速率档位 */}
                              <div className="space-y-2 pt-2 border-t border-[var(--rx-border-soft)]">
                                <div className="flex items-center justify-between text-body-sm">
                                  <span className="font-semibold flex items-center gap-1.5">
                                    <Waves className="h-4 w-4 text-[var(--rx-accent)]" />
                                    <span>波浪流动速率</span>
                                  </span>
                                  <span className="text-caption-xs font-mono text-[var(--rx-fg-faint)]">
                                    {settings.heatmapWaveSpeed === "fast"
                                      ? "湍急活力 (1.8s)"
                                      : settings.heatmapWaveSpeed === "slow"
                                      ? "舒缓缓流 (4.5s)"
                                      : "标准微波 (3.0s)"}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { id: "slow", name: "舒缓缓流 (4.5s)" },
                                    { id: "normal", name: "标准微波 (3.0s)" },
                                    { id: "fast", name: "湍急活力 (1.8s)" },
                                  ].map((speed) => (
                                    <button
                                      key={speed.id}
                                      type="button"
                                      onClick={() =>
                                        updateSetting("heatmapWaveSpeed", speed.id as any)
                                      }
                                      className={cn(
                                        "p-2 rounded-xl text-caption-xs font-bold border transition-all text-center rx-press",
                                        settings.heatmapWaveSpeed === speed.id
                                          ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/30 text-[var(--rx-accent)] shadow-xs"
                                          : "border-[var(--rx-border-soft)] text-[var(--rx-fg-dim)] hover:bg-[var(--rx-sidebar-hover)]"
                                      )}
                                    >
                                      {speed.name}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 满水基准目标 */}
                              <div className="pt-2 border-t border-[var(--rx-border-soft)]">
                                <SliderRow
                                  label="单日满水基准目标 (100% 满格)"
                                  icon={<Droplets className="h-4 w-4" />}
                                  value={settings.heatmapTargetDaily}
                                  min={10}
                                  max={100}
                                  step={5}
                                  unit="张卡"
                                  onValueChange={(v) => updateSetting("heatmapTargetDaily", v)}
                                  marks={[
                                    { value: 10, label: "10 (轻量)" },
                                    { value: 30, label: "30 (适中推荐)" },
                                    { value: 60, label: "60 (进阶冲刺)" },
                                    { value: 100, label: "100 (硬核)" },
                                  ]}
                                />
                              </div>
                            </div>
                          </SectionBlock>

                          {/* 3. 实时交互注水演练区 */}
                          <SectionBlock
                            title="热力流水实时交互演练"
                            description="拖动下方滑块实时观察当前主题下的注水、波浪与溢满光效。"
                          >
                            <div className="p-4 rounded-2xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/30 space-y-4">
                              {/* 5 档预设状态方格预览 */}
                              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] overflow-x-auto">
                                {[
                                  { label: "0% 空库", pct: 0, reviews: 0 },
                                  { label: "25% 浅水", pct: 25, reviews: Math.round(settings.heatmapTargetDaily * 0.25) },
                                  { label: "50% 半满", pct: 50, reviews: Math.round(settings.heatmapTargetDaily * 0.5) },
                                  { label: "75% 充盈", pct: 75, reviews: Math.round(settings.heatmapTargetDaily * 0.75) },
                                  { label: "100% 溢满", pct: 100, reviews: settings.heatmapTargetDaily },
                                ].map((sample, idx) => {
                                  const curTheme = HEATMAP_THEMES[settings.heatmapTheme as HeatmapThemeId] || HEATMAP_THEMES.emerald;
                                  const isFull = sample.pct >= 100;
                                  return (
                                    <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 min-w-[56px]">
                                      <div
                                        className={cn(
                                          "h-11 w-11 rounded-xl relative overflow-hidden border border-black/10 dark:border-white/10 flex items-center justify-center transition-all rx-liquid-cell",
                                          isFull && "rx-water-full-pulse"
                                        )}
                                        style={{
                                          backgroundColor: curTheme.colors[0],
                                          boxShadow: isFull ? `0 0 14px ${curTheme.glow}` : undefined,
                                        }}
                                      >
                                        {sample.pct > 0 && (
                                          <div
                                            className="absolute bottom-0 inset-x-0 transition-all duration-500 overflow-visible"
                                            style={{
                                              height: `${sample.pct}%`,
                                              background: curTheme.liquidGrad,
                                            }}
                                          >
                                            {settings.heatmapWaveEffect && sample.pct < 100 && (
                                              <FluidWaveWaterLines
                                                waveColor={curTheme.waveColor}
                                                waveBack={curTheme.waveBack}
                                                speedSec={
                                                  settings.heatmapWaveSpeed === "fast"
                                                    ? "1.8s"
                                                    : settings.heatmapWaveSpeed === "slow"
                                                    ? "4.5s"
                                                    : "3s"
                                                }
                                              />
                                            )}
                                          </div>
                                        )}
                                        <span className="relative z-10 text-micro-xxs font-mono font-bold text-white/90 drop-shadow-sm">
                                          {sample.pct}%
                                        </span>
                                      </div>
                                      <span className="text-micro-xxs font-medium text-[var(--rx-fg-faint)] truncate">
                                        {sample.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 自由注水拖拽滑块与实时大格演示 */}
                              <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between text-body-sm">
                                  <span className="font-semibold text-caption-xs text-[var(--rx-fg-faint)]">
                                    拖动动态体验任意水位 ({previewWaterLevel}%)
                                  </span>
                                  <span className="font-mono text-xs font-bold text-[var(--rx-accent)]">
                                    约 {Math.round((previewWaterLevel / 100) * settings.heatmapTargetDaily)} 张卡片
                                  </span>
                                </div>

                                <div className="flex items-center gap-4">
                                  {/* 实时动态注水方格 */}
                                  {(() => {
                                    const curTheme = HEATMAP_THEMES[settings.heatmapTheme as HeatmapThemeId] || HEATMAP_THEMES.emerald;
                                    const isFull = previewWaterLevel >= 100;
                                    return (
                                      <div
                                        className={cn(
                                          "h-14 w-14 rounded-2xl relative overflow-hidden shrink-0 border border-black/10 dark:border-white/10 flex items-center justify-center transition-all rx-liquid-cell shadow-xs",
                                          isFull && "rx-water-full-pulse"
                                        )}
                                        style={{
                                          backgroundColor: curTheme.colors[0],
                                          boxShadow: isFull ? `0 0 16px ${curTheme.glow}` : undefined,
                                        }}
                                      >
                                        {previewWaterLevel > 0 && (
                                          <div
                                            className="absolute bottom-0 inset-x-0 transition-all duration-300 overflow-visible"
                                            style={{
                                              height: `${previewWaterLevel}%`,
                                              background: curTheme.liquidGrad,
                                            }}
                                          >
                                            {settings.heatmapWaveEffect && previewWaterLevel < 100 && (
                                              <FluidWaveWaterLines
                                                waveColor={curTheme.waveColor}
                                                waveBack={curTheme.waveBack}
                                                speedSec={
                                                  settings.heatmapWaveSpeed === "fast"
                                                    ? "1.8s"
                                                    : settings.heatmapWaveSpeed === "slow"
                                                    ? "4.5s"
                                                    : "3s"
                                                }
                                              />
                                            )}
                                          </div>
                                        )}
                                        <span className="relative z-10 text-caption-xs font-mono font-bold text-white/95 drop-shadow-sm">
                                          {previewWaterLevel}%
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  <div className="flex-1 space-y-1">
                                    <Slider
                                      value={previewWaterLevel}
                                      min={0}
                                      max={100}
                                      step={1}
                                      onValueChange={setPreviewWaterLevel}
                                    />
                                    <div className="flex justify-between text-micro-xxs text-[var(--rx-fg-faint)] font-mono">
                                      <span>0% 空置</span>
                                      <span>50% 半满</span>
                                      <span>100% 满水</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </SectionBlock>
                        </>
                      )}

                      {/* 经典模式专属设置 */}
                      {settings.heatmapStyle === "classic" && (
                        <>
                          <SectionBlock
                            title="经典方格呈现与目标配置"
                            description="配置经典 GitHub / Anki 原生纯色阶方格的每日目标与波浪揭示动效。"
                          >
                            <div className="space-y-4">
                              {/* 单日满额基准目标 */}
                              <SliderRow
                                label="单日满额基准目标 (最高第 4 级色阶)"
                                icon={<Droplets className="h-4 w-4" />}
                                value={settings.heatmapTargetDaily}
                                min={10}
                                max={100}
                                step={5}
                                unit="张卡"
                                onValueChange={(v) => updateSetting("heatmapTargetDaily", v)}
                                marks={[
                                  { value: 10, label: "10 (轻量)" },
                                  { value: 30, label: "30 (适中推荐)" },
                                  { value: 60, label: "60 (进阶冲刺)" },
                                  { value: 100, label: "100 (硬核)" },
                                ]}
                              />

                              <div className="divide-y divide-[var(--rx-border-soft)] pt-1 border-t border-[var(--rx-border-soft)]">
                                <ToggleRow
                                  title="经典方格波浪式揭示 (Wave-like Reveal)"
                                  description="在经典方格模式下开启平滑波浪涟漪阵列逐列展开动效。"
                                  checked={settings.heatmapClassicWaveReveal}
                                  onChange={(v) => {
                                    updateSetting("heatmapClassicWaveReveal", v);
                                    setWavePreviewKey((k) => k + 1);
                                  }}
                                />

                                <ToggleRow
                                  title="显示方格公历日期"
                                  description="在每个热力格中心显示当前公历日期数字。"
                                  checked={settings.heatmapShowDayNumber}
                                  onChange={(v) => updateSetting("heatmapShowDayNumber", v)}
                                />
                              </div>
                            </div>
                          </SectionBlock>

                          {/* 经典方格波浪揭示 (Wave Reveal) 演练与测试 */}
                          <SectionBlock
                            title="经典方格波浪式揭示 (Wave-like Reveal) 演示"
                            description="模拟 14 周经典方格日历阵列的斜向波浪式渐进揭示展开效果。"
                          >
                            <div className="p-4 rounded-2xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/30 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-caption-xs text-[var(--rx-fg-faint)]">
                                  {settings.heatmapClassicWaveReveal
                                    ? "✨ 波浪揭示已启用（每次切牌组或刷新时波浪渐进浮现）"
                                    : "⏹️ 波浪揭示已关闭（方格静态瞬间呈现）"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setWavePreviewKey((k) => k + 1)}
                                  className="gap-1.5 text-caption-xs font-bold rx-press"
                                >
                                  <AnimatedRotateCw size={14} trigger={wavePreviewKey} />
                                  重放波浪揭示
                                </Button>
                              </div>

                              {/* 模拟迷你网格 */}
                              <div
                                key={`modal_wave_reveal_preview_${wavePreviewKey}`}
                                className="flex gap-1.5 p-3 rounded-xl bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] overflow-x-auto"
                              >
                                {Array.from({ length: 14 }).map((_, col) => {
                                  const curTheme =
                                    HEATMAP_THEMES[settings.heatmapTheme as HeatmapThemeId] ||
                                    HEATMAP_THEMES.emerald;
                                  return (
                                    <div key={col} className="flex flex-col gap-1.5">
                                      {Array.from({ length: 7 }).map((_, row) => {
                                        const level = ((col * 3 + row * 2) % 5);
                                        const delayMs = col * 14 + row * 18;
                                        return (
                                          <div
                                            key={row}
                                            className={cn(
                                              "h-4 w-4 rounded-xs transition-all shadow-2xs",
                                              level === 0 && "border border-[var(--rx-border-soft)]",
                                              settings.heatmapClassicWaveReveal && "rx-classic-cell-reveal"
                                            )}
                                            style={{
                                              backgroundColor: curTheme.colors[level],
                                              animationDelay: settings.heatmapClassicWaveReveal
                                                ? `${delayMs}ms`
                                                : undefined,
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </SectionBlock>
                        </>
                      )}
                    </>
                  )}

                  {/* TAB 4: 知识星系 */}
                  {currentTab === "galaxy" && (
                    <>
                      <SectionBlock
                        title="知识星系 3D 渲染"
                        description="调节三维记忆星系引力模拟、恒星光晕与目标留存率。"
                      >
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-body-sm font-bold text-[var(--rx-fg)]">
                            渲染画质档位
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { id: "high", name: "极致画质 (全特效+抗锯齿)" },
                              { id: "balanced", name: "平衡模式 (推荐)" },
                              { id: "low", name: "节能省电 (降帧)" },
                            ].map((q) => (
                              <button
                                key={`galaxy_q_${q.id}`}
                                type="button"
                                onClick={() =>
                                  updateSetting("galaxyQuality", q.id as any)
                                }
                                className={cn(
                                  "p-3 rounded-xl border text-body-sm font-bold transition-all rx-press",
                                  settings.galaxyQuality === q.id
                                    ? "border-[#E11D48] bg-[#E11D48]/10 text-[#E11D48]"
                                    : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                                )}
                              >
                                {q.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <SliderRow
                          label="目标记忆留存率 (Retention Rate)"
                          value={settings.galaxyDefaultRetention}
                          min={80}
                          max={97}
                          step={1}
                          unit="%"
                          accentColor="#E11D48"
                          onValueChange={(v) => updateSetting("galaxyDefaultRetention", v)}
                        />

                        <div className="divide-y divide-[var(--rx-border-soft)] pt-2">
                          <ToggleRow
                            title="恒星辉光与引力波特效"
                            description="为高频复习的核心记忆节点渲染发光光晕与星云离子。"
                            checked={settings.galaxyGlowEffect}
                            onChange={(v) => updateSetting("galaxyGlowEffect", v)}
                          />
                          <ToggleRow
                            title="空闲时自动旋转漫游"
                            description="无交互时缓缓旋转视角展示三维记忆图谱全貌。"
                            checked={settings.galaxyAutoRotate}
                            onChange={(v) => updateSetting("galaxyAutoRotate", v)}
                          />
                        </div>
                      </div>
                    </SectionBlock>

                    {/* 3D 记忆星系图谱渲染层级（多选列表，方块在左，文字在右） */}
                    <SectionBlock
                      title="星系渲染层级控制"
                      description="选择需要在 3D 记忆宇宙视口中显示的三维天体与图层元素。"
                    >
                      <CheckboxGroup
                        title="3D 图层渲染清单"
                        description="方块统一在左对齐，勾选即刻应用至 3D 星系画布"
                      >
                        {[
                          {
                            id: "core_nodes",
                            label: "牌组核心恒星球 (Core Celestial Spheres)",
                            description: "代表根牌组的大质量恒星核心天体。",
                          },
                          {
                            id: "gravity_orbits",
                            label: "记忆引力轨道连接线 (Gravitational Orbits)",
                            description: "基于复习艾宾浩斯留存率计算的引力关联力导向轨道。",
                          },
                          {
                            id: "lapse_particles",
                            label: "遗忘易错卡红色预警粒子 (Lapse Risk Particles)",
                            description: "高失误率卡片环绕形成的红色警示微尘云。",
                          },
                          {
                            id: "tag_nebulae",
                            label: "标签分类星云雾气 (Tag Nebulae)",
                            description: "按 Anki 标签维度聚合的弥漫星云光雾背景。",
                          },
                        ].map((item) => {
                          const isChecked = (settings.multiSelectGalaxyElements || []).includes(item.id);
                          return (
                            <Checkbox
                              key={`galaxy_elem_${item.id}`}
                              checked={isChecked}
                              onChange={(nextChecked) => {
                                const current = settings.multiSelectGalaxyElements || [];
                                const updated = nextChecked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id);
                                updateSetting("multiSelectGalaxyElements", updated);
                              }}
                              label={item.label}
                              description={item.description}
                            />
                          );
                        })}
                      </CheckboxGroup>
                    </SectionBlock>
                  </>
                )}

                  {/* TAB 5: AI 智学 */}
                  {currentTab === "ai" && (
                    <SectionBlock
                      title="AI 智能助教配置"
                      description="配置大语言模型辅助拆解难词长句、生成记忆口诀与配图。"
                    >
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-body-sm font-bold text-[var(--rx-fg)]">
                            AI 模型引擎
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { id: "gemini-flash", name: "Gemini 1.5 Flash (推荐)" },
                              { id: "gemini-pro", name: "Gemini 1.5 Pro (深度分析)" },
                              { id: "local", name: "本地 Ollama 模型" },
                            ].map((m) => (
                              <button
                                key={`aimodel_${m.id}`}
                                type="button"
                                onClick={() =>
                                  updateSetting("aiAssistantModel", m.id as any)
                                }
                                className={cn(
                                  "p-3 rounded-xl border text-body-sm font-bold transition-all rx-press",
                                  settings.aiAssistantModel === m.id
                                    ? "border-[#E11D48] bg-[#E11D48]/10 text-[#E11D48]"
                                    : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                                )}
                              >
                                {m.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-body-sm font-bold text-[var(--rx-fg)]">
                            自定义助教提示词模板 (System Prompt)
                          </label>
                          <textarea
                            value={settings.aiPromptTemplate}
                            onChange={(e) =>
                              updateSetting("aiPromptTemplate", e.target.value)
                            }
                            rows={3}
                            className="w-full p-3 rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] text-body-sm font-mono resize-none"
                          />
                        </div>
                      </div>
                    </SectionBlock>
                  )}

                  {/* TAB 6: 语言与翻译 */}
                  {currentTab === "language" && (
                    <SectionBlock
                      title="语言与划词翻译"
                      description="选择界面显示语言与卡片划词查词翻译引擎。"
                    >
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-body-sm font-bold text-[var(--rx-fg)]">
                            界面显示语言
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                              { id: "zh-CN", name: "简体中文 (Chinese)" },
                              { id: "en-US", name: "English (US)" },
                              { id: "ja-JP", name: "日本語 (Japanese)" },
                            ].map((lang) => (
                              <button
                                key={`lang_${lang.id}`}
                                type="button"
                                onClick={() => {
                                  updateSetting("language", lang.id);
                                  toast({ title: `语言已切换为 ${lang.name}` });
                                }}
                                className={cn(
                                  "p-3 rounded-xl border text-left transition-all rx-press flex items-center justify-between text-body-sm font-semibold",
                                  settings.language === lang.id
                                    ? "border-[#E11D48] bg-[#E11D48]/10 font-bold text-[#E11D48]"
                                    : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                                )}
                              >
                                <span>{lang.name}</span>
                                {settings.language === lang.id && <Check className="h-4 w-4" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="divide-y divide-[var(--rx-border-soft)] pt-2">
                          <ToggleRow
                            title="卡片生词自动划词释义"
                            description="长按或选中卡片文本时弹出轻量释义气泡。"
                            checked={settings.autoTranslateCard}
                            onChange={(v) => updateSetting("autoTranslateCard", v)}
                          />
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <label className="text-body-sm font-bold text-[var(--rx-fg)]">
                            划词翻译引擎
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { id: "deepseek", name: "DeepSeek 语法解析" },
                              { id: "google", name: "Google 翻译引擎" },
                              { id: "builtin", name: "内置离线简明词典" },
                            ].map((engine) => (
                              <button
                                key={`engine_${engine.id}`}
                                type="button"
                                onClick={() =>
                                  updateSetting("translationEngine", engine.id as any)
                                }
                                className={cn(
                                  "p-3 rounded-xl border text-body-sm font-semibold transition-all rx-press",
                                  settings.translationEngine === engine.id
                                    ? "border-[#E11D48] bg-[#E11D48]/10 text-[#E11D48]"
                                    : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                                )}
                              >
                                {engine.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </SectionBlock>
                  )}

                  {/* TAB 7: 存储与缓存 */}
                  {currentTab === "resources" && (
                    <>
                      <SectionBlock
                        title="存储与缓存管理"
                        description="调节媒体缓存分配与本地 SQLite 统计数据库维护。"
                      >
                        <div className="space-y-4">
                          <SliderRow
                            label="本地图片与音频缓存上限"
                            value={settings.maxMemoryCacheMB}
                            min={128}
                            max={2048}
                            step={64}
                            unit="MB"
                            onValueChange={(v) => updateSetting("maxMemoryCacheMB", v)}
                          />

                          <div className="flex items-center justify-between pt-2 border-t border-[var(--rx-border-soft)]">
                            <div className="space-y-0.5">
                              <div className="text-body-sm font-semibold">清理本地临时会话缓存</div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                                释放今日埋没队列与临时媒体 Blob 缓存。
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleClearCache}
                              className="text-body-sm font-bold gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rx-press"
                            >
                              <Trash2 className="h-4 w-4" />
                              清理缓存
                            </Button>
                          </div>
                        </div>
                      </SectionBlock>

                      {/* 数据备份与导出范围（多选列表，方块在左，文字在右） */}
                      <SectionBlock
                        title="数据备份与导出包含范围"
                        description="多选配置全量导出与本地归档时包含的实体数据项。"
                      >
                        <CheckboxGroup
                          title="包含数据项清单"
                          description="方块统一在左对齐，便于快速排查备份范围"
                        >
                          {[
                            {
                              id: "decks_schema",
                              label: "牌组结构与卡片笔记模板 (Decks & Models Schema)",
                              description: "包含所有牌组层级树、模型字段与 CSS 渲染样式表。",
                            },
                            {
                              id: "revlog_history",
                              label: "复习历史与增量日志 (Revlog History)",
                              description: "包含每一次作答评分按键、复习耗时与艾宾浩斯间隔变化。",
                            },
                            {
                              id: "media_audio",
                              label: "媒体发音包与配图 (Media Assets)",
                              description: "包含 collection.media 目录内的音频与高清图表。",
                            },
                            {
                              id: "retention_stats",
                              label: "本地热力图与聚合统计缓存 (Stats Cache)",
                              description: "包括 SQLite 日历聚合表与各牌组记忆留存率统计结果。",
                            },
                          ].map((item) => {
                            const isChecked = (settings.multiSelectDataBackups || []).includes(
                              item.id
                            );
                            return (
                              <Checkbox
                                key={`backup_item_${item.id}`}
                                checked={isChecked}
                                onChange={(nextChecked) => {
                                  const current = settings.multiSelectDataBackups || [];
                                  const updated = nextChecked
                                    ? [...current, item.id]
                                    : current.filter((id) => id !== item.id);
                                  updateSetting("multiSelectDataBackups", updated);
                                }}
                                label={item.label}
                                description={item.description}
                              />
                            );
                          })}
                        </CheckboxGroup>
                      </SectionBlock>
                    </>
                  )}

                  {/* TAB 8: 更新 */}
                  {currentTab === "updates" && (
                    <SectionBlock
                      title="应用更新与下载"
                      description="检查 Reasonix Anki 桌面工作台的最新稳定版本。"
                    >
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--rx-bg-soft)]/50 border border-[var(--rx-border-soft)]">
                        <div className="flex items-center gap-3">
                          <AnimatedCheckCircle2 size={20} className="text-emerald-500" />
                          <div>
                            <div className="text-body-nm font-bold">当前已是最新版本</div>
                            <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                              版本: v0.1.0 (Build 2026.08) · 架构: x86_64-tauri2
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => toast({ title: "已检查更新，当前为最新版本" })}
                          className="text-body-sm font-bold gap-1.5 rx-press"
                        >
                          <AnimatedRefreshCw size={16} />
                          检查更新
                        </Button>
                      </div>
                    </SectionBlock>
                  )}

                  {/* TAB 9: 关于 */}
                  {currentTab === "about" && (
                    <SectionBlock
                      title="关于 Reasonix Anki"
                      description="基于 AnkiConnect 的现代 Anki 桌面工作台 · 纯净高效的知识管理与记忆沉淀体验。"
                    >
                      <div className="space-y-4">
                        {/* 核心产品标识与运行架构 */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[var(--rx-bg-soft)]/60 border border-[var(--rx-border-soft)] gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="p-2.5 rounded-2xl bg-[var(--rx-accent-soft)] text-[var(--rx-accent)] shadow-xs">
                              <AnimatedGraduationCap size={28} />
                            </div>
                            <div>
                              <div className="text-body-nm font-bold flex items-center gap-2">
                                <span>Reasonix Anki Desktop</span>
                                <Badge variant="secondary" className="text-micro-xxs font-mono font-bold">
                                  v0.1.0-release
                                </Badge>
                              </div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)] mt-0.5 font-mono">
                                运行环境: {inTauri ? "Tauri 2 (Rust native)" : "Web / Proxy mode"} · 协议: AnkiConnect v6
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const info = `Reasonix Anki Desktop v0.1.0\nRuntime: ${inTauri ? "Tauri 2 (Rust)" : "Web"}\nAnkiConnect: ${connection.version ? `v${connection.version}` : "Not connected"}\nUA: ${navigator.userAgent}`;
                                navigator.clipboard?.writeText(info);
                                toast({ title: "已复制诊断环境信息到剪贴板" });
                              }}
                              className="text-body-sm font-bold gap-1.5 rx-press"
                              title="复制系统与环境诊断信息"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              复制诊断信息
                            </Button>
                            <Badge variant="outline" className="text-badge-xs font-mono">
                              MIT License
                            </Badge>
                          </div>
                        </div>

                        {/* 技术栈架构说明 */}
                        <div className="space-y-2">
                          <div className="text-body-sm font-bold flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-[var(--rx-accent)]" />
                            <span>底层技术栈与架构设计</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            <div className="p-3 rounded-xl bg-[var(--rx-bg-soft)]/40 border border-[var(--rx-border-soft)] space-y-1">
                              <div className="flex items-center gap-1.5 text-caption-xs font-bold text-[var(--rx-fg)]">
                                <Cpu className="h-3.5 w-3.5 text-orange-500" />
                                <span>桌面底座</span>
                              </div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                                Tauri 2 + Rust 极速薄层
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[var(--rx-bg-soft)]/40 border border-[var(--rx-border-soft)] space-y-1">
                              <div className="flex items-center gap-1.5 text-caption-xs font-bold text-[var(--rx-fg)]">
                                <Code2 className="h-3.5 w-3.5 text-cyan-500" />
                                <span>前端视图</span>
                              </div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                                React 19 + TypeScript
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[var(--rx-bg-soft)]/40 border border-[var(--rx-border-soft)] space-y-1">
                              <div className="flex items-center gap-1.5 text-caption-xs font-bold text-[var(--rx-fg)]">
                                <AnimatedSparkles size={14} className="text-amber-500" />
                                <span>设计系统</span>
                              </div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                                @reasonix/ui + Tailwind v4
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[var(--rx-bg-soft)]/40 border border-[var(--rx-border-soft)] space-y-1">
                              <div className="flex items-center gap-1.5 text-caption-xs font-bold text-[var(--rx-fg)]">
                                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                                <span>状态管线</span>
                              </div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                                TanStack Query + Zustand
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[var(--rx-bg-soft)]/40 border border-[var(--rx-border-soft)] space-y-1">
                              <div className="flex items-center gap-1.5 text-caption-xs font-bold text-[var(--rx-fg)]">
                                <Database className="h-3.5 w-3.5 text-indigo-500" />
                                <span>本地聚合</span>
                              </div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                                SQLite (tauri-plugin-sql)
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-[var(--rx-bg-soft)]/40 border border-[var(--rx-border-soft)] space-y-1">
                              <div className="flex items-center gap-1.5 text-caption-xs font-bold text-[var(--rx-fg)]">
                                <ShieldCheck className="h-3.5 w-3.5 text-rose-500" />
                                <span>安全渲染</span>
                              </div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                                DOMPurify + Iframe 沙箱
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 即将推出：生态扩展与遥测概览（骨架屏占位与预告） */}
                        <div className="space-y-3 pt-2 border-t border-[var(--rx-border-soft)]">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="text-body-sm font-bold flex items-center gap-1.5">
                                <AnimatedPuzzle size={16} className="text-purple-500" />
                                <span>社区插件与模板生态 (M7 筹备中)</span>
                                <Badge variant="secondary" className="text-micro-xxs font-bold">
                                  即将推出
                                </Badge>
                              </div>
                              <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                                第三方 Anki 模板市场、自定义评分脚本与 AI 翻译插件拓展机制。
                              </div>
                            </div>
                          </div>

                          {/* 骨架屏占位 */}
                          <div className="p-3.5 rounded-xl border border-dashed border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/20 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <Skeleton className="h-9 w-9 rounded-xl" />
                                <div className="space-y-1.5">
                                  <Skeleton className="h-4 w-32 rounded-md" />
                                  <Skeleton className="h-3 w-48 rounded-md" />
                                </div>
                              </div>
                              <Skeleton className="h-7 w-20 rounded-lg" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <Skeleton className="h-14 rounded-lg" />
                              <Skeleton className="h-14 rounded-lg" />
                              <Skeleton className="h-14 rounded-lg" />
                            </div>
                          </div>
                        </div>

                        {/* 开源致谢与声明 */}
                        <div className="pt-2 border-t border-[var(--rx-border-soft)] flex flex-wrap items-center justify-between gap-2 text-caption-xs text-[var(--rx-fg-faint)]">
                          <div>
                            致谢 AnkiConnect 插件原作者 Alex Yatskov (FooSoft) 与广大 Anki 开源社区
                          </div>
                          <div className="flex items-center gap-3">
                            <a
                              href="https://git.sr.ht/~foosoft/anki-connect"
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-[var(--rx-accent)] flex items-center gap-1 transition-colors"
                            >
                              AnkiConnect 文档
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <a
                              href="https://apps.ankiweb.net/"
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-[var(--rx-accent)] flex items-center gap-1 transition-colors"
                            >
                              Anki 官网
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </SectionBlock>
                  )}

                  {/* TAB 插件与同步（v2 设置功能回归：插件状态/诊断/关于） */}
                  {currentTab === "plugins" && (
                    <div className="space-y-4">
                      <PluginSyncCard />
                      <DiagnosticsCard />
                      <AboutCard />
                    </div>
                  )}

                  {/* TAB 10: Feature flags (仅开发者模式可见) */}
                  {currentTab === "flags" && (
                    <SectionBlock
                      title="Feature flags (实验性功能)"
                      description="仅供开发者与高级用户调试的高级实验性开关。"
                    >
                      <div className="divide-y divide-[var(--rx-border-soft)]">
                        <ToggleRow
                          title="Experimental Audio Graph"
                          description="启用底层 Web Audio API 动态滤波与实时频谱计算管线。"
                          checked={settings.flagExperimentalAudioGraph}
                          onChange={(v) =>
                            updateSetting("flagExperimentalAudioGraph", v)
                          }
                        />
                        <ToggleRow
                          title="WebGL2 Compute Shader (3D 星系)"
                          description="使用硬件加速 Compute Shader 计算百万级恒星引力碰撞。"
                          checked={settings.flagWebGL2ComputeShader}
                          onChange={(v) => updateSetting("flagWebGL2ComputeShader", v)}
                        />
                        <ToggleRow
                          title="Direct SQLite Bridge"
                          description="绕过 HTTP 直接走 Tauri Rust 原生 SQLite 增量同步。"
                          checked={settings.flagDirectSQLiteBridge}
                          onChange={(v) => updateSetting("flagDirectSQLiteBridge", v)}
                        />
                      </div>
                    </SectionBlock>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* 底部淡出遮罩 */}
            <div
              className={cn(
                "pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[var(--rx-bg)] to-transparent z-10 transition-opacity duration-200",
                showBottomMask ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------- 辅助视觉子组件 ---------------- */

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[18px] font-bold text-[var(--rx-fg)] leading-[1.4] tracking-tight">{title}</h2>
        <p className="text-[14px] font-normal text-[var(--rx-fg)]/80 leading-[1.5] mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ThemeCard({
  title,
  icon,
  selected,
  onClick,
  previewClass,
  barClass,
  itemClass,
  pillClass,
  subBarClass,
}: {
  title: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  previewClass: string;
  barClass: string;
  itemClass: string;
  pillClass?: string;
  subBarClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col rounded-2xl border overflow-hidden text-left transition-all rx-press active:scale-[0.97]",
        selected
          ? "border-[#E11D48] ring-2 ring-[#E11D48]/30 shadow-xs"
          : "border-[var(--rx-border-soft)] hover:border-neutral-400 dark:hover:border-neutral-600"
      )}
    >
      <div className={cn("h-28 w-full p-4 flex items-center justify-center relative select-none", previewClass)}>
        <div className={cn("w-full max-w-[160px] p-2.5 rounded-xl flex items-center gap-2.5 shadow-xs border border-white/5", itemClass)}>
          <div className={cn("h-7 w-7 rounded-lg shrink-0", pillClass || "bg-black/20 dark:bg-white/20")} />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className={cn("h-2 w-14 rounded-full", barClass)} />
            <div className={cn("h-1.5 w-9 rounded-full opacity-80", subBarClass || barClass)} />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 bg-[var(--rx-bg-elev)] flex items-center justify-between border-t border-[var(--rx-border-soft)]">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-4 w-4 rounded-full border flex items-center justify-center transition-all",
              selected
                ? "border-[#E11D48] bg-transparent text-[#E11D48]"
                : "border-[var(--rx-border-soft)] bg-transparent"
            )}
          >
            {selected ? (
              <div className="h-2 w-2 rounded-full bg-[#E11D48]" />
            ) : null}
          </div>
          <span className="text-caption-xs font-bold text-[var(--rx-fg)] flex items-center gap-1">
            <span>{title}</span>
            <span className="text-[var(--rx-fg-faint)] text-caption-xs">{icon}</span>
          </span>
        </div>
      </div>
    </button>
  );
}

// 辅助色相转换
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}
