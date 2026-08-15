import React from "react";
import {
  Brain,
  Timer,
  CloudSun,
  Flame,
  Grid,
  Quote,
  Gamepad2,
  Music,
} from "lucide-react";
import { Widget, WidgetProps } from "./types";
import { GlassWeatherWidget } from "./GlassWeatherWidget";
import { MeetingReminderWidget } from "./MeetingReminderWidget";
import { GlassMusicWidget } from "./GlassMusicWidget";

// Custom component renderers for registered widgets
const QuickCardWidget: React.FC<WidgetProps> = ({ className = "" }) => {
  const [flipped, setFlipped] = React.useState(false);
  return (
    <div
      onClick={() => setFlipped(!flipped)}
      className={`p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl cursor-pointer select-none space-y-2 text-center shadow-sm hover:border-[var(--rx-accent)] transition-all ${className}`}
    >
      <div className="flex items-center justify-between text-xs text-[var(--rx-fg-dim)] font-mono">
        <span>N3 闪卡</span>
        <span>{flipped ? "释义" : "单词"}</span>
      </div>
      {!flipped ? (
        <div className="space-y-1 py-1">
          <div className="text-lg font-bold text-[var(--rx-accent)]">
            素晴らしい
          </div>
          <div className="text-xs text-[var(--rx-fg-dim)]">すばらしい</div>
        </div>
      ) : (
        <div className="space-y-1 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 py-1">
          <div className="text-xs font-bold text-amber-500">
            [形容词] 极好的；出色的
          </div>
        </div>
      )}
    </div>
  );
};

const PomodoroWidget: React.FC<WidgetProps> = ({ className = "" }) => {
  const [running, setRunning] = React.useState(false);
  const [seconds, setSeconds] = React.useState(25 * 60);

  React.useEffect(() => {
    let interval: any = null;
    if (running && seconds > 0) {
      interval = setInterval(() => setSeconds((s) => s - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [running, seconds]);

  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");

  return (
    <div className={`p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl flex items-center justify-between gap-3 shadow-sm ${className}`}>
      <div>
        <span className="text-xs text-[var(--rx-fg-dim)]">沉浸专注模式</span>
        <div className="text-2xl font-mono font-bold text-sky-400">{m}:{s}</div>
      </div>
      <button
        onClick={() => setRunning(!running)}
        className="px-3 py-1.5 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl transition-colors cursor-pointer"
      >
        {running ? "暂停" : "开始"}
      </button>
    </div>
  );
};

const StreakWidget: React.FC<WidgetProps> = ({ className = "" }) => (
  <div className={`p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl flex items-center justify-between shadow-sm ${className}`}>
    <div className="flex items-center gap-2.5">
      <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
        <Flame className="h-5 w-5 fill-rose-500" />
      </div>
      <div>
        <div className="text-xs font-bold text-rose-500">14 天连续打卡</div>
        <div className="text-[10px] text-[var(--rx-fg-dim)]">学霸状态中 🔥</div>
      </div>
    </div>
    <div className="font-mono text-xs text-amber-500 font-bold">💎 1,280</div>
  </div>
);

const ForecastWidget: React.FC<WidgetProps> = ({ className = "" }) => (
  <div className={`p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl space-y-2 shadow-sm ${className}`}>
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--rx-fg-dim)]">记忆留存率</span>
      <span className="font-bold text-emerald-500 font-mono">92.5%</span>
    </div>
    <div className="w-full h-2 bg-[var(--rx-bg-soft)] rounded-full overflow-hidden">
      <div className="h-full bg-emerald-500 rounded-full w-[92.5%]" />
    </div>
    <div className="text-[10px] text-[var(--rx-fg-dim)] flex justify-between font-mono">
      <span>黄金时段: 20:00</span>
      <span>待复习: 45 卡</span>
    </div>
  </div>
);

const HeatmapWidget: React.FC<WidgetProps> = ({ className = "" }) => (
  <div className={`p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl space-y-2 shadow-sm ${className}`}>
    <div className="text-xs text-[var(--rx-fg-dim)] font-mono flex justify-between">
      <span>活跃轨迹</span>
      <span>428 卡</span>
    </div>
    <div className="grid grid-cols-12 gap-1">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={`reg_heatmap_cell_${i}`}
          className={`h-3 rounded-xs ${
            i % 4 === 0
              ? "bg-amber-500"
              : i % 3 === 0
              ? "bg-amber-500/60"
              : i % 2 === 0
              ? "bg-amber-500/25"
              : "bg-[var(--rx-bg-soft)]"
          }`}
        />
      ))}
    </div>
  </div>
);

const QuoteWidget: React.FC<WidgetProps> = ({ className = "" }) => (
  <div className={`p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl space-y-1 text-center shadow-sm ${className}`}>
    <div className="text-sm font-bold text-indigo-400">「継続は力なり」</div>
    <div className="text-xs text-[var(--rx-fg-dim)]">坚持就是力量 —— 日积月累。</div>
  </div>
);

const ArcadeEntryWidget: React.FC<WidgetProps> = ({ className = "" }) => (
  <div className={`p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl flex items-center justify-between shadow-sm ${className}`}>
    <div>
      <div className="text-xs font-bold text-amber-400">街机碰一碰连连看</div>
      <div className="text-[10px] text-[var(--rx-fg-dim)]">ADHD 极速对决</div>
    </div>
    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
      <Gamepad2 className="h-5 w-5" />
    </div>
  </div>
);

/** 所有已注册的桌面小组件列表 */
export const REGISTERED_WIDGETS: Widget[] = [
  {
    id: "widget-glass-music-gareth",
    name: "Gareth.T「玻璃 demo」音乐胶囊",
    category: "fun",
    size: "2x1",
    description: "1:1 临摹复刻黑白复古光影专辑、珊瑚粉跳动均衡器音浪与微米级白色胶囊进度滑块",
    icon: Music,
    badge: "1:1 复刻",
    previewType: "game",
    component: GlassMusicWidget,
  },
  {
    id: "widget-meeting-reminder",
    name: "You Have a Meeting 会议提醒卡",
    category: "time",
    size: "1x1",
    description: "1:1 还原暖黄明艳语境、毛线球图标、时间高对比透显与会议行程提醒",
    icon: Timer,
    badge: "1:1 复刻",
    previewType: "timer",
    component: MeetingReminderWidget,
  },
  {
    id: "widget-glass-weather-3d",
    name: "Calicut 1:1 极光拟物天气卡",
    category: "analytics",
    size: "2x2",
    description: "1:1 还原 3D 太阳弧线轨迹、空气质量 AQI 彩虹轴与云量轻透拟物小组件",
    icon: CloudSun,
    badge: "1:1 复刻",
    previewType: "forecast",
    component: GlassWeatherWidget,
  },
  {
    id: "widget-card-quick",
    name: "迷你闪卡背单词",
    category: "memory",
    size: "2x1",
    description: "桌面级即时记忆卡，支持双面翻转与发音，随手巩固单字",
    icon: Brain,
    badge: "热门",
    previewType: "card",
    component: QuickCardWidget,
  },
  {
    id: "widget-pomodoro",
    name: "沉浸专注番茄钟",
    category: "time",
    size: "2x1",
    description: "25分钟经典番茄倒计时，带大脑高效专注状态环与环形进度",
    icon: Timer,
    badge: "高效",
    previewType: "timer",
    component: PomodoroWidget,
  },
  {
    id: "widget-forecast",
    name: "学海与脑力预报",
    category: "analytics",
    size: "2x2",
    description: "实时计算记忆留存曲线、今日预估复习量与黄金学习时段",
    icon: CloudSun,
    previewType: "forecast",
    component: ForecastWidget,
  },
  {
    id: "widget-streak",
    name: "连胜与勋章战报",
    category: "fun",
    size: "1x1",
    description: "直观打卡天数、连击状态与多邻国联赛排名简报",
    icon: Flame,
    badge: "推荐",
    previewType: "streak",
    component: StreakWidget,
  },
  {
    id: "widget-heatmap",
    name: "学习热力矩阵",
    category: "analytics",
    size: "2x1",
    description: "呈现近 26 周的复习活跃度，记录每一次专注积淀",
    icon: Grid,
    previewType: "heatmap",
    component: HeatmapWidget,
  },
  {
    id: "widget-quote",
    name: "日汉励志名言",
    category: "fun",
    size: "2x1",
    description: "每日更新精选日语学术金句与名言，沉浸感满满",
    icon: Quote,
    previewType: "quote",
    component: QuoteWidget,
  },
  {
    id: "widget-arcade-entry",
    name: "街机连连看快捷件",
    category: "fun",
    size: "1x1",
    description: "一键调起 Arcade 碰一碰与极速释义挑战",
    icon: Gamepad2,
    previewType: "game",
    component: ArcadeEntryWidget,
  },
];

export function getWidgetById(id: string): Widget | undefined {
  return REGISTERED_WIDGETS.find((w) => w.id === id);
}
