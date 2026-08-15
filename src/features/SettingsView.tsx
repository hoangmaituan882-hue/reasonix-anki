/**
 * SettingsView.tsx - Reasonix Anki 现代化系统设置工作台
 * 遵循标准排版与字体系统规范：
 * - 字号档位：--font-size-xxs(10px), --font-size-xs(12px), --font-size-sm(14px), --font-size-nm(16px), --font-size-md(18px), --font-size-lg(20px), --font-size-xl(24px), --font-size-2xl(32px), --font-size-3xl(48px)
 * - 字重规范：正文 --font-weight-text = 500 (medium)，标题 --font-weight-heading = 800 (extrabold)
 * - 标题工具类：heading-xl / heading-lg / heading-md / heading-2xl
 */
import { useState } from "react";
import {
  Plug,
  Palette,
  GraduationCap,
  Orbit,
  HardDrive,
  RefreshCw,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Code2,
  Sliders,
  Sparkles,
  Key,
  Save,
  Trash2,
  Sun,
  Moon,
  ExternalLink,
  Cpu,
  Database,
  Layers,
  ShieldCheck,
  Activity,
  Puzzle,
  Copy,
  TrendingUp,
  Waves,
  Droplets,
} from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Separator,
  Skeleton,
  cn,
} from "@reasonix/ui";
import { useSettingsStore } from "../stores/settings";
import { DIRECTIONS, useAppStore } from "../stores/app";
import { useAnkiConnection } from "../lib/anki/useConnection";
import { anki } from "../lib/anki/actions";
import { inTauri } from "../lib/anki/transport";
import { openSettingsWindow } from "../lib/window";
import { toast, toastError } from "../components/ToasterLite";
import {
  HEATMAP_THEMES,
  FluidWaveWaterLines,
  type HeatmapThemeId,
} from "./settings/heatmapPreview";
import {
  Checkbox,
  CheckboxGroup,
  ToggleRow,
} from "../components/SettingsControls";

type SettingsTab = "connection" | "appearance" | "review" | "stats" | "galaxy" | "data";

interface SettingsViewProps {
  standalone?: boolean;
}

export function SettingsView({ standalone = false }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("connection");
  const { settings, updateSetting, updateSettings, resetToDefaults } = useSettingsStore();
  const { direction, setDirection, dark, toggleDark } = useAppStore();
  const connection = useAnkiConnection();

  // 临时编辑状态
  const [hostInput, setHostInput] = useState(settings.ankiConnectHost);
  const [portInput, setPortInput] = useState(String(settings.ankiConnectPort));
  const [apiKeyInput, setApiKeyInput] = useState(settings.ankiApiKey);
  const [syncing, setSyncing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [wavePreviewKey, setWavePreviewKey] = useState(0);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

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

  // 测试 AnkiConnect 连接
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const ver = await anki.version();
      setTestResult({
        success: true,
        message: `连接成功！AnkiConnect 版本: v${ver}`,
      });
      toast({ title: `连接成功 (v${ver})`, variant: "default" });
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

  // 触发 AnkiWeb 同步
  const handleSyncAnkiWeb = async () => {
    setSyncing(true);
    try {
      await anki.sync();
      toast({ title: "AnkiWeb 数据同步完成", variant: "default" });
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
      toast({ title: `已清理 ${buriedKeys.length} 条会话缓存`, variant: "default" });
    } catch (err) {
      toastError("清理缓存失败", err);
    }
  };

  // 重置全部偏好
  const handleResetAll = () => {
    if (confirm("确定要将所有设置恢复为默认值吗？")) {
      resetToDefaults();
      setHostInput("127.0.0.1");
      setPortInput("8765");
      setApiKeyInput("");
      toast({ title: "所有设置已恢复为初始默认值", variant: "default" });
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* 顶部标题区：heading-xl (24px, extrabold 800) + 次要说明 (14px) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--rx-border-soft)] pb-4">
        <div>
          <h1 className="heading-xl flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-[var(--rx-accent)] text-[var(--rx-accent-fg)] shadow-xs">
              <Sliders className="h-5 w-5" />
            </span>
            <span>系统设置</span>
          </h1>
          <p className="text-body-sm text-[var(--rx-fg-faint)] mt-1">
            管理 AnkiConnect 服务桥接、外观界面、复习调度规则与 3D 星系偏好
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!standalone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void openSettingsWindow()}
              className="text-body-sm font-bold gap-1.5 rx-press"
              title="在独立窗口中打开设置界面"
            >
              <ExternalLink className="h-4 w-4 text-[var(--rx-accent)]" />
              独立窗口打开
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="text-body-sm font-bold gap-1.5 text-[var(--rx-fg-dim)] hover:text-rose-500 rx-press"
          >
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </Button>
        </div>
      </div>

      {/* 左右分栏主体 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* 左侧 Tab 导航栏 */}
        <aside className="md:col-span-4 lg:col-span-3 space-y-1 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] p-2 rounded-2xl shadow-xs">
          <TabButton
            active={activeTab === "connection"}
            onClick={() => setActiveTab("connection")}
            icon={<Plug className="h-4 w-4" />}
            title="连接与服务"
            description="AnkiConnect / 端口 / 同步"
            badge={
              connection.status === "connected" ? (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              )
            }
          />
          <TabButton
            active={activeTab === "appearance"}
            onClick={() => setActiveTab("appearance")}
            icon={<Palette className="h-4 w-4" />}
            title="外观与色彩"
            description="6 大主题 / 暗黑模式 / 缩放"
          />
          <TabButton
            active={activeTab === "review"}
            onClick={() => setActiveTab("review")}
            icon={<GraduationCap className="h-4 w-4" />}
            title="复习与调度"
            description="队列上限 / 音频自播 / 脚本"
          />
          <TabButton
            active={activeTab === "stats"}
            onClick={() => setActiveTab("stats")}
            icon={<TrendingUp className="h-4 w-4" />}
            title="统计与热力"
            description="8 大流体主题 / 注水波浪 / 满水基准"
          />
          <TabButton
            active={activeTab === "galaxy"}
            onClick={() => setActiveTab("galaxy")}
            icon={<Orbit className="h-4 w-4" />}
            title="知识星系"
            description="3D 渲染 / 留存率 / 光晕"
          />
          <TabButton
            active={activeTab === "data"}
            onClick={() => setActiveTab("data")}
            icon={<HardDrive className="h-4 w-4" />}
            title="存储与关于"
            description="缓存清理 / 环境信息 / 协议"
          />
        </aside>

        {/* 右侧设置项内容区 */}
        <div className="md:col-span-8 lg:col-span-9 space-y-5">
          {/* TAB 1: 连接与服务 */}
          {activeTab === "connection" && (
            <div className="space-y-4">
              <SettingCard
                title="AnkiConnect 服务桥接"
                description="Reasonix Anki 通过 HTTP 协议与本地运行中的 Anki 实例通信"
              >
                <div className="space-y-4">
                  {/* 连接状态概览 */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-neutral-900/60 border border-[var(--rx-border-soft)]">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={cn(
                          "h-11 w-11 rounded-xl flex items-center justify-center font-bold",
                          connection.status === "connected"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                        )}
                      >
                        {connection.status === "connected" ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <AlertCircle className="h-6 w-6" />
                        )}
                      </div>
                      <div>
                        <div className="text-body-nm font-bold flex items-center gap-2">
                          <span>
                            {connection.status === "connected"
                              ? "服务已连接"
                              : connection.status === "checking"
                              ? "正在检测连接..."
                              : "未连接至 Anki"}
                          </span>
                          {connection.version && (
                            <Badge variant="outline" className="text-badge-xs font-mono">
                              v{connection.version}
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

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testingConnection}
                      onClick={handleTestConnection}
                      className="text-body-sm font-bold gap-1.5 rx-press"
                    >
                      <RefreshCw className={cn("h-4 w-4", testingConnection && "animate-spin")} />
                      测试连通
                    </Button>
                  </div>

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
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
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
                  <div className="space-y-1.5 pt-2">
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
                      如果您的 AnkiConnect 配置文件配置了 `apiKey`，请在此输入对应令牌
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveConnection}
                      className="text-body-sm font-bold gap-1.5 rx-press"
                    >
                      <Save className="h-4 w-4" />
                      保存连接配置
                    </Button>
                  </div>
                </div>
              </SettingCard>

              {/* AnkiWeb 云端同步 */}
              <SettingCard
                title="AnkiWeb 云端同步"
                description="触发 Anki 原生数据库与 AnkiWeb 云端服务器的双向同步"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-body-nm font-bold">立即同步全部牌组</div>
                    <div className="text-body-sm text-[var(--rx-fg-faint)]">
                      调用 Anki 原生 sync 命令将当前学习进度上传至 AnkiWeb 账号
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncing || connection.status !== "connected"}
                    onClick={handleSyncAnkiWeb}
                    className="text-body-sm font-bold gap-1.5 rx-press"
                  >
                    <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                    {syncing ? "正在同步..." : "同步至 AnkiWeb"}
                  </Button>
                </div>
              </SettingCard>
            </div>
          )}

          {/* TAB 2: 外观与色彩 */}
          {activeTab === "appearance" && (
            <div className="space-y-4">
              <SettingCard
                title="主题风格方向"
                description="切换 Reasonix Design Kit 精心调配的 6 大色彩方向"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {DIRECTIONS.map((d) => {
                    const isSelected = direction === d.id;
                    return (
                      <button
                        key={`settings_theme_dir_${d.id}`}
                        type="button"
                        onClick={() => setDirection(d.id)}
                        className={cn(
                          "flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all rx-press",
                          isSelected
                            ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 shadow-xs ring-2 ring-[var(--rx-accent)]/30"
                            : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <span className="text-body-sm font-bold">{d.label}</span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-[var(--rx-accent)]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-4 w-4 rounded-full"
                            style={{
                              backgroundColor:
                                d.id === "graphite"
                                  ? "#52525B"
                                  : d.id === "aurora"
                                  ? "#10B981"
                                  : d.id === "slate"
                                  ? "#3B82F6"
                                  : d.id === "carbon"
                                  ? "#64748B"
                                  : d.id === "nocturne"
                                  ? "#8B5CF6"
                                  : "#F59E0B",
                            }}
                          />
                          <span className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                            {d.id}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SettingCard>

              <SettingCard
                title="明暗色彩模式"
                description="随心切换浅色明亮或沉浸深色夜览"
              >
                <div className="grid grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (dark) toggleDark();
                    }}
                    className={cn(
                      "flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-all rx-press",
                      !dark
                        ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 ring-2 ring-[var(--rx-accent)]/30 font-bold"
                        : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                    )}
                  >
                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                      <Sun className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-body-sm font-bold">浅色明亮模式</div>
                      <div className="text-caption-xs text-[var(--rx-fg-faint)]">日间阅读高对比度</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!dark) toggleDark();
                    }}
                    className={cn(
                      "flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-all rx-press",
                      dark
                        ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 ring-2 ring-[var(--rx-accent)]/30 font-bold"
                        : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                    )}
                  >
                    <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                      <Moon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-body-sm font-bold">深色夜览模式</div>
                      <div className="text-caption-xs text-[var(--rx-fg-faint)]">护眼暗黑纯净界面</div>
                    </div>
                  </button>
                </div>
              </SettingCard>

              <SettingCard
                title="阅读字号与动画"
                description="针对不同显示器尺寸调整卡片内容与动效强度"
              >
                <div className="space-y-4">
                  {/* 字号缩放 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-body-sm font-bold">复习卡片字号缩放</div>
                      <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                        调整问题面与答案面的基准文字尺寸（当前 {settings.cardFontSizePercent}%）
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[90, 100, 115, 130].map((size) => (
                        <Button
                          key={`font_scale_${size}`}
                          size="sm"
                          variant={settings.cardFontSizePercent === size ? "default" : "outline"}
                          onClick={() => updateSetting("cardFontSizePercent", size)}
                          className="text-body-sm font-bold px-3 h-8"
                        >
                          {size}%
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--rx-border-soft)] pt-1">
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
                      description="在各功能视图切换时启用基于 CSS / Framer 的平滑淡入动效。"
                      checked={settings.smoothPageTransitions}
                      onChange={(v) => updateSetting("smoothPageTransitions", v)}
                    />

                    <ToggleRow
                      title="沉浸助手动态频谱"
                      description="右侧专注抽屉中展示实时跳动的白噪音音频跳跃律动。"
                      checked={settings.enableAudioVisualizer}
                      onChange={(v) => updateSetting("enableAudioVisualizer", v)}
                    />
                  </div>
                </div>
              </SettingCard>
            </div>
          )}

          {/* TAB 3: 复习与调度 */}
          {activeTab === "review" && (
            <div className="space-y-4">
              <SettingCard
                title="复习会话与队列容量"
                description="配置单次复习流程的加载策略与多媒体行为"
              >
                <div className="space-y-4">
                  {/* 队列容量 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-body-sm font-bold">单次复习队列上限</div>
                      <span className="text-body-sm font-mono font-bold text-[var(--rx-accent)]">
                        {settings.maxSessionQueue} 张 / 组
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={500}
                      step={25}
                      value={settings.maxSessionQueue}
                      onChange={(e) => updateSetting("maxSessionQueue", Number(e.target.value))}
                      className="w-full h-2 bg-[var(--rx-bg-soft)] rounded-lg appearance-none cursor-pointer accent-[var(--rx-accent)]"
                    />
                    <div className="flex justify-between text-micro-xxs text-[var(--rx-fg-faint)] font-mono">
                      <span>50 (极速微课)</span>
                      <span>300 (推荐默认)</span>
                      <span>500 (长程冲刺)</span>
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--rx-border-soft)] pt-1">
                    <ToggleRow
                      title="自动播放发音音频"
                      description="翻到包含 [sound:] 或 [anki:play] 的卡片面时自动触发播放音频。"
                      checked={settings.autoPlayAudio}
                      onChange={(v) => updateSetting("autoPlayAudio", v)}
                    />

                    <ToggleRow
                      title="脚本模式 (Script Execution Mode)"
                      description="允许卡片 HTML 模板执行自定义 JavaScript（适合日文 Mining 重模板与复杂动态动效模板）。"
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
              </SettingCard>

              {/* 多选列表 1: 键盘快捷键配置（方块在左，文字在右） */}
              <SettingCard
                title="复习快捷键与按键控制"
                description="配置复习会话期间支持的键盘操作快捷指令（支持多选列表勾选）"
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
                    const isChecked = (settings.multiSelectReviewShortcuts || []).includes(item.id);
                    return (
                      <Checkbox
                        key={`settings_view_sc_${item.id}`}
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
              </SettingCard>

              {/* 多选列表 2: 卡片筛选范围（方块在左，文字在右） */}
              <SettingCard
                title="卡片筛选与统计队列口径"
                description="勾选统计概览与复习队列默认包含的卡片状态范围"
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
                        key={`settings_view_ct_${item.id}`}
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
              </SettingCard>
            </div>
          )}

          {/* TAB: 统计与热力图 */}
          {activeTab === "stats" && (
            <div className="space-y-4">
              <SettingCard
                title="热力图渲染模式"
                description="选择现代动态流体注水效果，或保持与之前一样的经典纯色阶方格"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 流体注水模式 */}
                  <button
                    type="button"
                    onClick={() => updateSetting("heatmapStyle", "fluid")}
                    className={cn(
                      "flex flex-col items-start p-4 rounded-2xl border text-left transition-all rx-press relative overflow-hidden",
                      settings.heatmapStyle !== "classic"
                        ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 shadow-xs ring-2 ring-[var(--rx-accent)]/30"
                        : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 font-bold">
                          <Waves className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="text-body-sm font-bold">现代流体注水模式 (Fluid Liquid)</div>
                          <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                            杯体注水、双层流动波浪与满水溢光
                          </div>
                        </div>
                      </div>
                      {settings.heatmapStyle !== "classic" && (
                        <CheckCircle2 className="h-5 w-5 text-[var(--rx-accent)]" />
                      )}
                    </div>
                    <div className="w-full flex items-center gap-1.5 mt-2 p-2 rounded-xl bg-[var(--rx-bg-soft)]/60 border border-[var(--rx-border-soft)]">
                      <div className="text-micro-xxs font-mono text-[var(--rx-fg-faint)]">预览:</div>
                      {[20, 50, 80, 100].map((fill, i) => (
                        <div
                          key={i}
                          className="h-6 flex-1 rounded-md bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] relative overflow-hidden"
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
                      "flex flex-col items-start p-4 rounded-2xl border text-left transition-all rx-press relative overflow-hidden",
                      settings.heatmapStyle === "classic"
                        ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 shadow-xs ring-2 ring-[var(--rx-accent)]/30"
                        : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold">
                          <Layers className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="text-body-sm font-bold">经典纯色方格模式 (Classic Solid)</div>
                          <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                            GitHub / Anki 原生经典纯色阶方块
                          </div>
                        </div>
                      </div>
                      {settings.heatmapStyle === "classic" && (
                        <CheckCircle2 className="h-5 w-5 text-[var(--rx-accent)]" />
                      )}
                    </div>
                    <div className="w-full flex items-center gap-1.5 mt-2 p-2 rounded-xl bg-[var(--rx-bg-soft)]/60 border border-[var(--rx-border-soft)]">
                      <div className="text-micro-xxs font-mono text-[var(--rx-fg-faint)]">预览:</div>
                      {["#A7F3D0", "#34D399", "#10B981", "#047857"].map((c, i) => (
                        <div
                          key={i}
                          className="h-6 flex-1 rounded-md border border-black/10 dark:border-white/10"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </button>
                </div>
              </SettingCard>

              <SettingCard
                title={
                  settings.heatmapStyle === "classic"
                    ? "经典方格色彩主题"
                    : "流体热力图色彩主题"
                }
                description={
                  settings.heatmapStyle === "classic"
                    ? "切换 8 款精心调配的经典 5 阶纯色阶方格调色板"
                    : "切换 8 款精心调配的流体注水色阶与满水溢光辉光"
                }
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.values(HEATMAP_THEMES).map((theme) => {
                    const isSelected = settings.heatmapTheme === theme.id;
                    return (
                      <button
                        key={`settings_view_theme_${theme.id}`}
                        type="button"
                        onClick={() => updateSetting("heatmapTheme", theme.id)}
                        className={cn(
                          "flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all rx-press relative overflow-hidden",
                          isSelected
                            ? "border-[var(--rx-accent)] bg-[var(--rx-accent-soft)]/20 shadow-xs ring-2 ring-[var(--rx-accent)]/30"
                            : "border-[var(--rx-border-soft)] hover:bg-[var(--rx-sidebar-hover)]"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{theme.emoji}</span>
                            <span className="text-body-sm font-bold">{theme.name}</span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-[var(--rx-accent)]" />
                          )}
                        </div>
                        {/* 5 阶色带 */}
                        <div className="flex items-center gap-1 w-full mt-1">
                          {theme.colors.map((c, i) => (
                            <span
                              key={i}
                              className="h-3.5 flex-1 rounded-sm border border-black/10 dark:border-white/10"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SettingCard>

              {/* 流体模式专属设置 */}
              {settings.heatmapStyle !== "classic" && (
                <>
                  <SettingCard
                    title="流水波动与注水机制"
                    description="当学习量越多时，方格水位线越高，波浪如流水般荡漾直到填满"
                  >
                    <div className="space-y-4">
                      {/* 流体波动开关 */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-body-sm font-bold flex items-center gap-1.5">
                            <Waves className="h-4 w-4 text-[var(--rx-accent)]" />
                            <span>开启流水波动注水动效</span>
                          </div>
                          <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                            根据单日复习量渲染液位水位线与实时起伏水波
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={settings.heatmapWaveEffect ? "default" : "outline"}
                          onClick={() =>
                            updateSetting("heatmapWaveEffect", !settings.heatmapWaveEffect)
                          }
                          className="text-body-sm font-bold h-8"
                        >
                          {settings.heatmapWaveEffect ? "波浪已开启" : "静态纯色"}
                        </Button>
                      </div>

                      <Separator className="bg-[var(--rx-border-soft)]" />

                      {/* 波浪速率 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-body-sm font-bold">波浪流动速率</div>
                          <span className="text-body-sm font-mono font-bold text-[var(--rx-accent)]">
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
                          ].map((spd) => (
                            <Button
                              key={spd.id}
                              size="sm"
                              variant={settings.heatmapWaveSpeed === spd.id ? "default" : "outline"}
                              onClick={() => updateSetting("heatmapWaveSpeed", spd.id as any)}
                              className="text-body-sm font-bold h-8"
                            >
                              {spd.name}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <Separator className="bg-[var(--rx-border-soft)]" />

                      {/* 满水基准目标 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-body-sm font-bold flex items-center gap-1.5">
                            <Droplets className="h-4 w-4 text-[var(--rx-accent)]" />
                            <span>单日满水基准目标 (100% 满格)</span>
                          </div>
                          <span className="text-body-sm font-mono font-bold text-[var(--rx-accent)]">
                            {settings.heatmapTargetDaily} 张卡
                          </span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={settings.heatmapTargetDaily}
                          onChange={(e) =>
                            updateSetting("heatmapTargetDaily", Number(e.target.value))
                          }
                          className="w-full h-2 bg-[var(--rx-bg-soft)] rounded-lg appearance-none cursor-pointer accent-[var(--rx-accent)]"
                        />
                        <div className="flex justify-between text-micro-xxs text-[var(--rx-fg-faint)] font-mono">
                          <span>10 (轻量)</span>
                          <span>30 (适中推荐)</span>
                          <span>60 (进阶冲刺)</span>
                          <span>100 (硬核)</span>
                        </div>
                      </div>

                      <div className="divide-y divide-[var(--rx-border-soft)] pt-1">
                        <ToggleRow
                          title="动态流体波浪起伏"
                          description="在有复习记录的单日方格内渲染双层起伏水线流动效果。"
                          checked={settings.heatmapWaveEffect}
                          onChange={(v) => updateSetting("heatmapWaveEffect", v)}
                        />

                        <ToggleRow
                          title="显示方格公历日期数字"
                          description="在热力图每个方格中央显示当前单日日期数字。"
                          checked={settings.heatmapShowDayNumber}
                          onChange={(v) => updateSetting("heatmapShowDayNumber", v)}
                        />
                      </div>
                    </div>
                  </SettingCard>

                  {/* 实时注水预览 */}
                  <SettingCard
                    title="热力流水实时交互演练"
                    description="各阶段水位线动态波浪与满水溢光脉冲效果展示"
                  >
                    <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[var(--rx-bg-soft)]/40 border border-[var(--rx-border-soft)] overflow-x-auto">
                      {[
                        { label: "0% 空库", pct: 0, count: 0 },
                        { label: "25% 浅水", pct: 25, count: Math.round(settings.heatmapTargetDaily * 0.25) },
                        { label: "50% 半满", pct: 50, count: Math.round(settings.heatmapTargetDaily * 0.5) },
                        { label: "75% 充盈", pct: 75, count: Math.round(settings.heatmapTargetDaily * 0.75) },
                        { label: "100% 满水溢光", pct: 100, count: settings.heatmapTargetDaily },
                      ].map((s, idx) => {
                        const curTheme = HEATMAP_THEMES[settings.heatmapTheme as HeatmapThemeId] || HEATMAP_THEMES.emerald;
                        const isFull = s.pct >= 100;
                        return (
                          <div key={idx} className="flex flex-col items-center gap-2 flex-1 min-w-[70px]">
                            <div
                              className={cn(
                                "h-12 w-12 rounded-xl relative overflow-hidden border border-black/10 dark:border-white/10 flex items-center justify-center transition-all rx-liquid-cell",
                                isFull && "rx-water-full-pulse"
                              )}
                              style={{
                                backgroundColor: curTheme.colors[0],
                                boxShadow: isFull ? `0 0 16px ${curTheme.glow}` : undefined,
                              }}
                            >
                              {s.pct > 0 && (
                                <div
                                  className="absolute bottom-0 inset-x-0 transition-all duration-500 overflow-visible"
                                  style={{
                                    height: `${s.pct}%`,
                                    background: curTheme.liquidGrad,
                                  }}
                                >
                                  {settings.heatmapWaveEffect && s.pct < 100 && (
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
                              <span className="relative z-10 text-caption-xs font-mono font-bold text-white/90 drop-shadow-sm">
                                {s.pct}%
                              </span>
                            </div>
                            <span className="text-micro-xxs font-bold text-[var(--rx-fg-dim)] text-center">
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </SettingCard>
                </>
              )}

              {/* 经典模式专属设置 */}
              {settings.heatmapStyle === "classic" && (
                <>
                  <SettingCard
                    title="经典方格呈现与目标配置"
                    description="配置经典 GitHub / Anki 原生质感纯色阶方格的每日目标与波浪揭示动效"
                  >
                    <div className="space-y-4">
                      {/* 单日满额基准目标 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-body-sm font-bold flex items-center gap-1.5">
                            <Droplets className="h-4 w-4 text-[var(--rx-accent)]" />
                            <span>单日满额基准目标 (最高第 4 级色阶)</span>
                          </div>
                          <span className="text-body-sm font-mono font-bold text-[var(--rx-accent)]">
                            {settings.heatmapTargetDaily} 张卡
                          </span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={settings.heatmapTargetDaily}
                          onChange={(e) =>
                            updateSetting("heatmapTargetDaily", Number(e.target.value))
                          }
                          className="w-full h-2 bg-[var(--rx-bg-soft)] rounded-lg appearance-none cursor-pointer accent-[var(--rx-accent)]"
                        />
                        <div className="flex justify-between text-micro-xxs text-[var(--rx-fg-faint)] font-mono">
                          <span>10 (轻量)</span>
                          <span>30 (适中推荐)</span>
                          <span>60 (进阶冲刺)</span>
                          <span>100 (硬核)</span>
                        </div>
                      </div>

                      <div className="divide-y divide-[var(--rx-border-soft)] pt-1">
                        <ToggleRow
                          title="经典方格波浪式揭示 (Wave-like Reveal)"
                          description="在经典方格模式下，以平滑波浪涟漪阵列逐列展开方格入场动效。"
                          checked={settings.heatmapClassicWaveReveal}
                          onChange={(v) => {
                            updateSetting("heatmapClassicWaveReveal", v);
                            setWavePreviewKey((k) => k + 1);
                          }}
                        />

                        <ToggleRow
                          title="显示方格公历日期数字"
                          description="在热力图每个方格中央显示当前单日日期数字。"
                          checked={settings.heatmapShowDayNumber}
                          onChange={(v) => updateSetting("heatmapShowDayNumber", v)}
                        />
                      </div>
                    </div>
                  </SettingCard>

                  {/* 经典方格波浪揭示 (Wave Reveal) 演练与测试 */}
                  <SettingCard
                    title="经典方格波浪式揭示 (Wave-like Reveal) 演示"
                    description="模拟 14 周经典方格日历阵列的斜向波浪式渐进揭示展开效果"
                  >
                    <div className="p-4 rounded-xl bg-[var(--rx-bg-soft)]/40 border border-[var(--rx-border-soft)] space-y-3">
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
                          <RotateCw className="h-3.5 w-3.5" />
                          重放波浪揭示
                        </Button>
                      </div>

                      {/* 模拟迷你网格 */}
                      <div
                        key={`settings_wave_reveal_preview_${wavePreviewKey}`}
                        className="flex gap-1.5 p-3 rounded-lg bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] overflow-x-auto"
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
                  </SettingCard>
                </>
              )}
            </div>
          )}

          {/* TAB 4: 知识星系 */}
          {activeTab === "galaxy" && (
            <div className="space-y-4">
              <SettingCard
                title="3D 星系渲染与性能"
                description="根据硬件配置调整 3D 粒子流与引力网画质"
              >
                <div className="space-y-4">
                  {/* 渲染档位 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-body-sm font-bold">图形渲染品质</div>
                      <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                        高品质渲染包含粒子流、多重发光光晕与星座引力网
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(["high", "balanced", "low"] as const).map((q) => (
                        <Button
                          key={`galaxy_q_${q}`}
                          size="sm"
                          variant={settings.galaxyQuality === q ? "default" : "outline"}
                          onClick={() => updateSetting("galaxyQuality", q)}
                          className="text-body-sm font-bold px-3 h-8"
                        >
                          {q === "high" ? "极致 3D" : q === "balanced" ? "平衡" : "节能省电"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--rx-border-soft)] pt-1">
                    <ToggleRow
                      title="恒星能量日冕光晕"
                      description="熟练卡片释放恒星金色日冕与呼吸光晕特效。"
                      checked={settings.galaxyGlowEffect}
                      onChange={(v) => updateSetting("galaxyGlowEffect", v)}
                    />

                    <ToggleRow
                      title="星系自动漫游自转"
                      description="空闲时星系球体以平缓速率自转展示星群分布。"
                      checked={settings.galaxyAutoRotate}
                      onChange={(v) => updateSetting("galaxyAutoRotate", v)}
                    />
                  </div>

                  <Separator className="bg-[var(--rx-border-soft)]" />

                  {/* 默认目标记忆留存率 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-body-sm font-bold">默认遗忘曲线目标留存率</div>
                      <span className="text-body-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {settings.galaxyDefaultRetention}% 目标留存
                      </span>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={97}
                      step={1}
                      value={settings.galaxyDefaultRetention}
                      onChange={(e) =>
                        updateSetting("galaxyDefaultRetention", Number(e.target.value))
                      }
                      className="w-full h-2 bg-[var(--rx-bg-soft)] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-micro-xxs text-[var(--rx-fg-faint)] font-mono">
                      <span>80% (轻松减负)</span>
                      <span>90% (黄金标准)</span>
                      <span>97% (严苛考前突击)</span>
                    </div>
                  </div>
                </div>
              </SettingCard>

              {/* 多选列表: 3D 星系空间图层（方块在左，文字在右） */}
              <SettingCard
                title="3D 星系空间图层与视觉元素"
                description="勾选在三维空间中渲染的天体与引力连线组件"
              >
                <CheckboxGroup
                  title="3D 空间图层清单"
                  description="方块统一在左对齐，便于快速排查图层状态"
                >
                  {[
                    {
                      id: "core_spheres",
                      label: "核心知识母星 (Core Spheres)",
                      description: "按牌组与词条聚集度的发光球体母核。",
                    },
                    {
                      id: "orbits",
                      label: "引力环道与记忆轨道 (Gravitational Orbits)",
                      description: "根据艾宾浩斯记忆熟练度划分的三维同心轨道环。",
                    },
                    {
                      id: "particles",
                      label: "遗忘边缘衰减粒子 (Lapse Particles)",
                      description: "即将到期需要巩固的动态粒子环与脉冲流。",
                    },
                    {
                      id: "nebulae",
                      label: "标签关联星云网 (Tag Nebulae)",
                      description: "跨牌组标签关联形成的彩色引力星云背景。",
                    },
                  ].map((item) => {
                    const isChecked = (settings.multiSelectGalaxyElements || []).includes(item.id);
                    return (
                      <Checkbox
                        key={`settings_view_gx_${item.id}`}
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
              </SettingCard>
            </div>
          )}

          {/* TAB 5: 存储与关于 */}
          {activeTab === "data" && (
            <div className="space-y-4">
              <SettingCard
                title="缓存与存储管理"
                description="管理本地临时媒体缓存与会话记录"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-body-sm font-bold">清空本地会话与临时缓存</div>
                    <div className="text-caption-xs text-[var(--rx-fg-faint)]">
                      释放今日暂存埋没队列与临时音频 Blob 缓存（不影响 Anki 核心数据库）
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
              </SettingCard>

              {/* 多选列表: 备份导出范围（方块在左，文字在右） */}
              <SettingCard
                title="数据备份与导出包含范围"
                description="多选配置全量导出与本地归档时包含的实体数据项"
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
                    const isChecked = (settings.multiSelectDataBackups || []).includes(item.id);
                    return (
                      <Checkbox
                        key={`settings_view_bk_${item.id}`}
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
              </SettingCard>

              {/* 关于软件 */}
              <SettingCard
                title="关于 Reasonix Anki"
                description="现代高效的 Anki 桌面工作台 · 纯净高效的知识管理与记忆沉淀体验"
              >
                <div className="space-y-4">
                  {/* 核心产品标识与运行架构 */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-neutral-900/50 border border-[var(--rx-border-soft)] gap-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[var(--rx-accent)] text-[var(--rx-accent-fg)] flex items-center justify-center font-black text-body-sm shadow-xs">
                        Rx
                      </div>
                      <div>
                        <div className="text-body-nm font-bold flex items-center gap-2">
                          <span>Reasonix Anki Desktop</span>
                          <Badge variant="secondary" className="text-micro-xxs font-mono font-bold">
                            v0.1.0-release
                          </Badge>
                        </div>
                        <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono mt-0.5">
                          运行架构: {inTauri ? "Tauri 2 (Rust native)" : "Web / Proxy mode"} · 协议: AnkiConnect v6
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const info = `Reasonix Anki Desktop v0.1.0\nRuntime: ${inTauri ? "Tauri 2 (Rust)" : "Web"}\nAnkiConnect: ${connection.version ? `v${connection.version}` : connection.status}\nUA: ${navigator.userAgent}`;
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
                      <div className="p-2.5 rounded-lg bg-[var(--rx-bg-soft)]/50 border border-[var(--rx-border-soft)] space-y-0.5">
                        <div className="flex items-center gap-1 text-caption-xs font-bold text-[var(--rx-fg)]">
                          <Cpu className="h-3.5 w-3.5 text-orange-500" />
                          <span>桌面底座</span>
                        </div>
                        <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                          Tauri 2 + Rust 极速薄层
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--rx-bg-soft)]/50 border border-[var(--rx-border-soft)] space-y-0.5">
                        <div className="flex items-center gap-1 text-caption-xs font-bold text-[var(--rx-fg)]">
                          <Code2 className="h-3.5 w-3.5 text-cyan-500" />
                          <span>前端视图</span>
                        </div>
                        <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                          React 19 + TypeScript
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--rx-bg-soft)]/50 border border-[var(--rx-border-soft)] space-y-0.5">
                        <div className="flex items-center gap-1 text-caption-xs font-bold text-[var(--rx-fg)]">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          <span>设计系统</span>
                        </div>
                        <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                          @reasonix/ui + Tailwind v4
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--rx-bg-soft)]/50 border border-[var(--rx-border-soft)] space-y-0.5">
                        <div className="flex items-center gap-1 text-caption-xs font-bold text-[var(--rx-fg)]">
                          <Activity className="h-3.5 w-3.5 text-emerald-500" />
                          <span>状态管线</span>
                        </div>
                        <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                          TanStack Query + Zustand
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--rx-bg-soft)]/50 border border-[var(--rx-border-soft)] space-y-0.5">
                        <div className="flex items-center gap-1 text-caption-xs font-bold text-[var(--rx-fg)]">
                          <Database className="h-3.5 w-3.5 text-indigo-500" />
                          <span>本地聚合</span>
                        </div>
                        <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                          SQLite (tauri-plugin-sql)
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[var(--rx-bg-soft)]/50 border border-[var(--rx-border-soft)] space-y-0.5">
                        <div className="flex items-center gap-1 text-caption-xs font-bold text-[var(--rx-fg)]">
                          <ShieldCheck className="h-3.5 w-3.5 text-rose-500" />
                          <span>安全渲染</span>
                        </div>
                        <div className="text-caption-xs text-[var(--rx-fg-faint)] font-mono">
                          DOMPurify + Iframe 沙箱
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 即将推出：社区插件与扩展生态（骨架屏占位与预告） */}
                  <div className="space-y-3 pt-2 border-t border-[var(--rx-border-soft)]">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-body-sm font-bold flex items-center gap-1.5">
                          <Puzzle className="h-4 w-4 text-purple-500" />
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
              </SettingCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 辅助卡片与 Tab 按钮组件 ---------------- */

function TabButton({
  active,
  onClick,
  icon,
  title,
  description,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all rx-press",
        active
          ? "bg-[var(--rx-accent)] text-[var(--rx-accent-fg)] font-bold shadow-xs"
          : "hover:bg-[var(--rx-sidebar-hover)] text-[var(--rx-fg-dim)]"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn(active ? "text-[var(--rx-accent-fg)]" : "text-[var(--rx-fg)]")}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-body-sm font-bold truncate">{title}</div>
          <div
            className={cn(
              "text-caption-xs truncate mt-0.5",
              active ? "text-[var(--rx-accent-fg)]/80" : "text-[var(--rx-fg-faint)]"
            )}
          >
            {description}
          </div>
        </div>
      </div>
      {badge && <div className="shrink-0 ml-2">{badge}</div>}
    </button>
  );
}

function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] p-5 shadow-xs space-y-4">
      <div>
        <h2 className="text-[18px] font-bold text-[var(--rx-fg)] leading-[1.4]">{title}</h2>
        <p className="text-[14px] font-normal text-[var(--rx-fg)]/80 leading-[1.5] mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}
