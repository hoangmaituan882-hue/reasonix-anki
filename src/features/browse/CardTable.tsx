import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  cn,
} from "@reasonix/ui";
import {
  CalendarClock,
  Copy,
  PauseCircle,
  PlayCircle,
  SquarePen,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCardSearch, PAGE_SIZE } from "../../lib/anki/query";
import type { CardInfo } from "../../lib/anki/schemas";
import { dueLabel, frontText } from "./browseUtil";
import { RowActions, useCardMutations } from "./RowActions";
import { toast, toastError } from "../../components/ToasterLite";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "../../components/ContextMenu";

interface Props {
  query: string;
  page: number;
  onPageChange: (page: number) => void;
  selectedCardId: number | null;
  onSelectCard: (id: number) => void;
}

/** 中栏卡片列表：findCards → 分页切片 → cardsInfo（技术方案 §4.3） */
export function CardTable({ query, page, onPageChange, selectedCardId, onSelectCard }: Props) {
  const { data, isPending, isError, error } = useCardSearch(query, page);

  if (isPending) {
    return (
      <div className="space-y-2 p-3" aria-label="加载中">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-3">
        <Alert variant="destructive">
          <AlertTitle>搜索失败</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : String(error)}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { cards, total } = data ?? { cards: [], total: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--rx-fg-faint)]">
        没有匹配的卡片（{query}）
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--rx-bg-soft)] text-xs text-[var(--rx-fg-faint)]">
            <tr>
              <Th className="w-[46%]">正面</Th>
              <Th className="w-[18%]">模板</Th>
              <Th className="w-[16%]">到期</Th>
              <Th className="w-[10%] text-right">复习</Th>
              <Th className="w-[10%]">
                <span className="sr-only">操作</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <Row
                key={card.cardId}
                card={card}
                selected={card.cardId === selectedCardId}
                onClick={() => onSelectCard(card.cardId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-[var(--rx-border-soft)] px-3 py-1.5 text-xs text-[var(--rx-fg-faint)]">
        <span>
          共 {total} 张 · 第 {page + 1}/{totalPages} 页
        </span>
        <span className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs rx-press"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs rx-press"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
          </Button>
        </span>
      </footer>
    </div>
  );
}

function Th({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <th className={cn("px-3 py-2 text-left font-medium", className)}>{children}</th>
  );
}

function Row({
  card,
  selected,
  onClick,
}: {
  card: CardInfo;
  selected: boolean;
  onClick: () => void;
}) {
  const {
    suspended,
    openEditor,
    suspendMut,
    dueMut,
    delMut,
    dueOpen,
    setDueOpen,
    days,
    setDays,
    delOpen,
    setDelOpen,
  } = useCardMutations(card);

  const copyText = (text: string, msg: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: msg }),
      () => toastError("复制失败", new Error("无法访问剪贴板")),
    );
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <tr
            onClick={onClick}
            aria-selected={selected}
            className={cn(
              "cursor-pointer border-b border-[var(--rx-border-soft)] transition-colors",
              selected ? "rx-accent-soft" : "hover:bg-[var(--rx-sidebar-hover)]",
              suspended && "opacity-55",
            )}
          >
            <td className="max-w-0 truncate px-3 py-2" title={frontText(card, 200)}>
              {frontText(card)}
            </td>
            <td className="px-3 py-2 text-xs text-[var(--rx-fg-dim)]">{card.modelName}</td>
            <td className="px-3 py-2">
              <Badge variant="outline" className="text-2xs font-normal">
                {dueLabel(card)}
              </Badge>
            </td>
            <td className="px-3 py-2 text-right text-xs text-[var(--rx-fg-faint)]">
              {card.reps ?? 0}
            </td>
            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
              <RowActions card={card} />
            </td>
          </tr>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56">
          <ContextMenuLabel>
            卡片 #{card.cardId} · 笔记 #{card.note}
          </ContextMenuLabel>

          <ContextMenuItem onSelect={() => openEditor(card.note)}>
            <SquarePen className="h-4 w-4 text-[var(--rx-accent)]" />
            <span>编辑笔记</span>
            <ContextMenuShortcut>E</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onSelect={() => suspendMut.mutate()}>
            {suspended ? (
              <PlayCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <PauseCircle className="h-4 w-4 text-amber-500" />
            )}
            <span>{suspended ? "恢复卡片" : "暂停卡片"}</span>
            <ContextMenuShortcut>Space</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onSelect={() => setDueOpen(true)}>
            <CalendarClock className="h-4 w-4 text-[var(--rx-fg)]" />
            <span>修改到期日 (改期)…</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem onSelect={() => copyText(frontText(card, 1000), "已复制正面文本")}>
            <Copy className="h-4 w-4 text-[var(--rx-fg-faint)]" />
            <span>复制正面文本</span>
          </ContextMenuItem>

          <ContextMenuItem onSelect={() => copyText(String(card.cardId), `已复制卡片 ID: ${card.cardId}`)}>
            <Copy className="h-4 w-4 shrink-0 text-[var(--rx-fg-faint)]" />
            <span className="shrink-0 whitespace-nowrap">复制卡片 ID</span>
            <ContextMenuShortcut title={`#${card.cardId}`}>
              #{String(card.cardId).length > 7 ? `${String(card.cardId).slice(0, 6)}...` : card.cardId}
            </ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem tone="destructive" onSelect={() => setDelOpen(true)}>
            <Trash2 className="h-4 w-4" />
            <span>删除笔记及卡片…</span>
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 改期 Dialog */}
      <Dialog open={dueOpen} onOpenChange={setDueOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>改期到…</DialogTitle>
            <DialogDescription className="text-xs">
              支持 Anki 语法：0 今天 · 1 明天 · 3-7 随机区间 · 1! 同时重置间隔
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="天数（如 1、3-7、1!）"
              onKeyDown={(e) => {
                if (e.key === "Enter") dueMut.mutate();
              }}
            />
            <Button onClick={() => dueMut.mutate()} disabled={dueMut.isPending}>
              改期
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDueOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除笔记及卡片？</DialogTitle>
            <DialogDescription className="text-xs">
              将删除该笔记及其全部卡片，此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => delMut.mutate()} disabled={delMut.isPending}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
