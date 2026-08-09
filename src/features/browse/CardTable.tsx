import { Alert, AlertDescription, AlertTitle, Badge, Skeleton, cn } from "@reasonix/ui";
import { Button } from "@reasonix/ui";
import type { ReactNode } from "react";
import { useCardSearch, PAGE_SIZE } from "../../lib/anki/query";
import type { CardInfo } from "../../lib/anki/schemas";
import { dueLabel, frontText } from "./browseUtil";
import { RowActions } from "./RowActions";

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
  const suspended = card.queue === -1;
  return (
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
      <td className="px-2 py-1.5">
        <RowActions card={card} />
      </td>
    </tr>
  );
}
