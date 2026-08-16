import { ChevronRight } from "lucide-react";
import {
  BarChart3,
  Copy,
  Play,
  PlusCircle,
  Search,
} from "lucide-react";
import { Badge, Skeleton, cn } from "@reasonix/ui";
import { useState } from "react";
import type { DeckConfig, DeckMap, DeckStats } from "../../lib/anki/schemas";
import { buildDeckTree, type DeckNode } from "./browseUtil";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "../../components/ContextMenu";
import { useAppStore } from "../../stores/app";
import { useEditorStore } from "../../stores/editor";
import { toast, toastError } from "../../components/ToasterLite";

interface Props {
  decks: DeckMap;
  stats: Record<string, DeckStats>;
  configs: Record<string, DeckConfig>;
  selected: string | null;
  onSelect: (fullName: string) => void;
  loading?: boolean;
}

/**
 * 左栏牌组树（技术方案 §5.1）
 * Badge 口径：新卡显示"已学/上限"（已学 = new.perDay − 今日剩余 new_count，
 * getDeckStats 的 counts 是今日剩余额度而非总数）；学/复显示今日剩余；
 * total_in_deck 挂在 title 提示。
 * 右键菜单：开始复习 / 在列表中筛选 / 添加新笔记 / 查看统计 / 复制牌组名。
 */
export function DeckTree({ decks, stats, configs, selected, onSelect, loading }: Props) {
  const deckNames = Object.keys(decks);
  const setView = useAppStore((s) => s.setView);
  const setPendingReviewDeck = useAppStore((s) => s.setPendingReviewDeck);
  const openNewNote = useEditorStore((s) => s.openNewNote);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(deckNames.map((name) => name.split("::")[0])),
  );

  const copyText = (text: string, title: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast({ title }))
      .catch(() => toastError("复制失败", new Error("clipboard 不可用")));
  };

  if (loading) {
    return (
      <div className="space-y-2 p-3" aria-label="加载中">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  const tree = buildDeckTree(deckNames);

  const toggle = (fullName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  };

  const renderNode = (node: DeckNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.fullName);
    const isSelected = selected === node.fullName;
    const deckId = decks[node.fullName];
    const st = deckId != null ? stats[String(deckId)] : undefined;
    const cfg = configs[node.fullName];
    const newCap = cfg?.new?.perDay;
    const learned =
      st && newCap != null ? Math.min(newCap, Math.max(0, newCap - st.new_count)) : null;

    return (
      <div key={node.fullName}>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              role="treeitem"
              aria-selected={isSelected}
              aria-expanded={hasChildren ? isOpen : undefined}
              title={st ? `${node.fullName} · 共 ${st.total_in_deck} 张卡片` : node.fullName}
              onClick={() => onSelect(node.fullName)}
              className={cn(
                "group flex cursor-pointer items-center gap-1 rounded-[var(--rx-r-m)] py-1.5 pr-2 text-sm transition-colors",
                isSelected
                  ? "rx-accent-soft"
                  : "hover:bg-[var(--rx-sidebar-hover)]",
              )}
              style={{
                paddingLeft: `${depth * 14 + 6}px`,
                color: isSelected ? "var(--rx-accent)" : "var(--rx-fg)",
              }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={isOpen ? "折叠" : "展开"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(node.fullName);
                  }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--rx-fg-faint)] hover:text-[var(--rx-fg)]"
                >
                  <ChevronRight
                    className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
                  />
                </button>
              ) : (
                <span className="w-4 shrink-0" aria-hidden />
              )}

              <span className="min-w-0 flex-1 truncate">{node.name}</span>

              {st ? (
                <span className="flex shrink-0 items-center gap-1">
                  <Badge
                    variant="outline"
                    className="h-4.5 border-transparent px-1 text-2xs font-medium rx-accent-soft"
                    style={{ color: "var(--rx-accent)" }}
                  >
                    {learned != null ? `新 ${learned}/${newCap}` : `新余 ${st.new_count}`}
                  </Badge>
                  {st.learn_count > 0 && (
                    <Badge variant="secondary" className="h-4.5 px-1 text-2xs font-normal">
                      学 {st.learn_count}
                    </Badge>
                  )}
                  {st.review_count > 0 && (
                    <Badge variant="secondary" className="h-4.5 px-1 text-2xs font-normal">
                      复 {st.review_count}
                    </Badge>
                  )}
                </span>
              ) : null}
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-56">
            <ContextMenuLabel>{node.fullName}</ContextMenuLabel>

            <ContextMenuItem
              onSelect={() => {
                setPendingReviewDeck(node.fullName);
                setView("review");
              }}
            >
              <Play className="h-4 w-4 text-[var(--rx-accent)] fill-[var(--rx-accent)]" />
              <span>开始复习此牌组</span>
              <ContextMenuShortcut>R</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem onSelect={() => onSelect(node.fullName)}>
              <Search className="h-4 w-4 text-[var(--rx-fg-dim)]" />
              <span>在列表中筛选</span>
            </ContextMenuItem>

            <ContextMenuItem onSelect={() => openNewNote(node.fullName)}>
              <PlusCircle className="h-4 w-4 text-[var(--rx-fg-dim)]" />
              <span>添加新笔记至此牌组</span>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onSelect={() => setView("stats")}>
              <BarChart3 className="h-4 w-4 text-[var(--rx-fg-dim)]" />
              <span>查看学习统计</span>
            </ContextMenuItem>

            <ContextMenuItem onSelect={() => copyText(node.fullName, `已复制牌组名：${node.fullName}`)}>
              <Copy className="h-4 w-4 text-[var(--rx-fg-faint)]" />
              <span>复制牌组名称</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {hasChildren && isOpen ? (
          <div role="group">{node.children.map((child) => renderNode(child, depth + 1))}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div role="tree" aria-label="牌组" className="space-y-0.5 overflow-y-auto p-2">
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
}
