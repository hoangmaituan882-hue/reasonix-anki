import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Switch,
  cn,
} from "@reasonix/ui";
import { Check, Settings } from "lucide-react";
import {
  DIRECTIONS,
  SETTINGS_DESIGNS,
  useAppStore,
  type Direction,
  type SettingsDesign,
} from "../stores/app";

/**
 * 设置抽屉（骨架预览 + 圆角开关）。
 *
 * 三种布局骨架（分栏式 / 标签式 / 卡片式）共用同一批"待接入"分组，切换即换布局预览，
 * 选择持久化到 ra.settingsDesign。当前唯一已接入的真设置项是"圆角窗口"开关
 * （ra.roundedCorners，纯 CSS 切换根容器圆角）；其余分组全部为 Skeleton + 禁用控件
 * 的占位骨架，标注"即将接入"，为后续设置项预留结构与样式。
 */

const PENDING_BADGE = (
  <Badge variant="outline" className="text-2xs font-normal text-[var(--rx-fg-faint)]">
    即将接入
  </Badge>
);

/** 占位骨架行：左侧标签骨架 + 右侧控件骨架 */
function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      <Skeleton className="h-7 w-14 rounded-[var(--rx-r-m)]" />
    </div>
  );
}

/** 共用的占位骨架分组（三种布局变体都以不同容器呈现同一组内容） */
function SharedSkeletonGroups() {
  return (
    <>
      <div className="space-y-4">
        {/* 外观分组：圆角 / 主题方向 / 深色模式已接入 */}
        <Card className="border-[var(--rx-border-soft)] bg-[var(--rx-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">外观</CardTitle>
            <CardDescription className="text-xs">
              窗口外观与主题相关设置
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="settings-rounded" className="text-sm">
                  圆角窗口
                </Label>
                <p className="text-2xs text-[var(--rx-fg-faint)]">
                  无边框透明窗口的 CSS 圆角；关闭后四角变直角
                </p>
              </div>
              <RoundedCornerSwitch />
            </div>
            <Separator className="bg-[var(--rx-border-soft)]" />
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="space-y-1">
                <Label className="text-sm">主题方向</Label>
                <p className="text-2xs text-[var(--rx-fg-faint)]">
                  界面配色方向，实时生效
                </p>
              </div>
              <DirectionSelect />
            </div>
            <Separator className="bg-[var(--rx-border-soft)]" />
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="settings-dark" className="text-sm">
                  深色模式
                </Label>
                <p className="text-2xs text-[var(--rx-fg-faint)]">
                  浅色 / 深色界面切换
                </p>
              </div>
              <DarkModeSwitch />
            </div>
          </CardContent>
        </Card>

        {/* 学习分组（纯骨架） */}
        <Card className="border-[var(--rx-border-soft)] bg-[var(--rx-card)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">学习</CardTitle>
              {PENDING_BADGE}
            </div>
            <CardDescription className="text-xs">
              默认牌组、自动音频与复习行为
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </CardContent>
        </Card>

        {/* 插件与同步分组（纯骨架） */}
        <Card className="border-[var(--rx-border-soft)] bg-[var(--rx-card)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">插件与同步</CardTitle>
              {PENDING_BADGE}
            </div>
            <CardDescription className="text-xs">
              配套插件授权与同步行为
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <SkeletonRow />
            <SkeletonRow />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** 圆角开关（已接入） */
function RoundedCornerSwitch() {
  const roundedCorners = useAppStore((state) => state.roundedCorners);
  const setRoundedCorners = useAppStore((state) => state.setRoundedCorners);
  return (
    <Switch
      id="settings-rounded"
      checked={roundedCorners}
      onCheckedChange={setRoundedCorners}
      aria-label="圆角窗口"
    />
  );
}

/** 主题方向选择器（已接入，实时生效） */
function DirectionSelect() {
  const direction = useAppStore((state) => state.direction);
  const setDirection = useAppStore((state) => state.setDirection);
  return (
    <Select
      value={direction}
      onValueChange={(value) => setDirection(value as Direction)}
    >
      <SelectTrigger className="w-36" aria-label="主题方向">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DIRECTIONS.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** 深色模式开关（已接入） */
function DarkModeSwitch() {
  const dark = useAppStore((state) => state.dark);
  const toggleDark = useAppStore((state) => state.toggleDark);
  return (
    <Switch
      id="settings-dark"
      checked={dark}
      onCheckedChange={toggleDark}
      aria-label="深色模式"
    />
  );
}

/** 变体切换器：分栏 / 标签 / 卡片 */
function DesignPicker({
  design,
  onChange,
}: {
  design: SettingsDesign;
  onChange: (design: SettingsDesign) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-[var(--rx-r-m)] bg-[var(--rx-sidebar)] p-1" role="tablist" aria-label="设置界面布局">
      {SETTINGS_DESIGNS.map(({ id, label }) => {
        const active = id === design;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "rx-press flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--rx-r-m)-4px)] px-3 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none",
              active
                ? "bg-[var(--rx-accent-soft)] text-[var(--rx-accent)]"
                : "text-[var(--rx-fg-dim)] hover:bg-[var(--rx-sidebar-hover)]",
            )}
          >
            {active && <Check className="h-3 w-3" aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** 分栏式布局骨架：左侧分组导航 + 右侧设置内容 */
function ColumnsLayout() {
  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div
        data-testid="columns-nav"
        className="hidden w-36 shrink-0 flex-col gap-1.5 sm:flex"
      >
        {["外观", "学习", "插件与同步", "关于"].map((section) => (
          <div
            key={section}
            className="flex items-center justify-between rounded-[var(--rx-r-m)] px-3 py-2 text-xs text-[var(--rx-fg-dim)]"
          >
            <span>{section}</span>
            <Skeleton className="h-2 w-2 rounded-full" />
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto pr-1">
        <SharedSkeletonGroups />
      </div>
    </div>
  );
}

/** 标签式布局骨架：顶部 Tabs + 当前面板骨架 */
function TabsLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        data-testid="tabs-nav"
        className="flex items-center gap-1 rounded-[var(--rx-r-m)] bg-[var(--rx-sidebar)] p-1"
      >
        {["外观", "学习", "插件与同步", "关于"].map((section, index) => (
          <div
            key={section}
            className={cn(
              "flex-1 rounded-[calc(var(--rx-r-m)-4px)] px-3 py-1.5 text-center text-xs",
              index === 0
                ? "bg-[var(--rx-accent-soft)] text-[var(--rx-accent)]"
                : "text-[var(--rx-fg-dim)]",
            )}
          >
            {section}
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SharedSkeletonGroups />
      </div>
    </div>
  );
}

/** 卡片式布局骨架：设置项以独立卡片平铺 */
function CardsLayout() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <SharedSkeletonGroups />
    </div>
  );
}

function SettingsBody() {
  const design = useAppStore((state) => state.settingsDesign);
  const setDesign = useAppStore((state) => state.setSettingsDesign);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <DesignPicker design={design} onChange={setDesign} />
      <div className="min-h-0 flex-1">
        {design === "columns" && <ColumnsLayout />}
        {design === "tabs" && <TabsLayout />}
        {design === "cards" && <CardsLayout />}
      </div>
    </div>
  );
}

export interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[420px] flex-col gap-0 p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b border-[var(--rx-border-soft)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--rx-accent)]" aria-hidden />
            <SheetTitle className="text-base">设置</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            外观与工作台偏好；未标注的分组为骨架预览，即将接入
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 px-5 py-4">
          <SettingsBody />
        </div>

        <SheetFooter className="border-t border-[var(--rx-border-soft)] px-5 py-3">
          <Button variant="outline" size="sm" className="rx-press" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
