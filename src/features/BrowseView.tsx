import { Search, X } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@reasonix/ui";
import { useEffect, useMemo, useState } from "react";
import { useCardSearch, useDeckConfigs, useDeckTree } from "../lib/anki/query";
import { useAppStore } from "../stores/app";
import { CardTable } from "./browse/CardTable";
import { DeckTree } from "./browse/DeckTree";
import { NotePreview } from "./browse/NotePreview";

/**
 * M1 牌组浏览器（技术方案 §5.1）：三栏 Resizable 布局
 * 左牌组树（已学/上限口径）→ 中卡片列表（Anki 搜索语法）→ 右笔记预览
 */
export function BrowseView() {
  const decksQ = useDeckTree();
  const deckNames = useMemo(
    () => Object.keys(decksQ.data?.decks ?? {}),
    [decksQ.data],
  );
  const configsQ = useDeckConfigs(deckNames);

  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const deck = selectedDeck ?? deckNames[0] ?? null;

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);

  // 统计热力图「在浏览中检索」：注入外部查询后清空（只消费一次）
  const browseQuery = useAppStore((s) => s.browseQuery);
  const setBrowseQuery = useAppStore((s) => s.setBrowseQuery);
  useEffect(() => {
    if (browseQuery != null) {
      setSearchInput(browseQuery);
      setAppliedSearch(browseQuery);
      setBrowseQuery(null);
    }
  }, [browseQuery, setBrowseQuery]);

  // 空输入 → 当前牌组范围；有输入 → 原生 Anki 搜索语法
  const query = appliedSearch?.trim()
    ? appliedSearch.trim()
    : deck
      ? `deck:"${deck}"`
      : "";

  // 查询变化时回到第一页、清空选中
  useEffect(() => {
    setPage(0);
    setSelectedCardId(null);
  }, [query]);

  // 与 CardTable 内部同 key，React Query 共享缓存，仅用于取选中卡片对象
  const cardsQ = useCardSearch(query, page);
  const selectedCard =
    cardsQ.data?.cards.find((c) => c.cardId === selectedCardId) ?? null;

  if (decksQ.isError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>
            牌组加载失败：
            {decksQ.error instanceof Error ? decksQ.error.message : String(decksQ.error)}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 搜索工具条 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--rx-border-soft)] p-2">
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <Search className="h-3.5 w-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setAppliedSearch(searchInput);
            }}
            placeholder='Anki 搜索语法，如 deck:"ceshi" is:due tag:日语（回车应用）'
            aria-label="卡片搜索"
          />
        </InputGroup>
        {appliedSearch ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs rx-press"
            onClick={() => {
              setAppliedSearch(null);
              setSearchInput("");
            }}
          >
            <X className="h-3.5 w-3.5" />
            清除搜索
          </Button>
        ) : (
          <span className="truncate text-xs text-[var(--rx-fg-faint)]">
            当前范围：{deck ?? "（无牌组）"}
          </span>
        )}
      </div>

      {/* 三栏 */}
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={27} minSize={18}>
            <DeckTree
              decks={decksQ.data?.decks ?? {}}
              stats={decksQ.data?.stats ?? {}}
              configs={configsQ.data ?? {}}
              selected={deck}
              onSelect={setSelectedDeck}
              loading={decksQ.isPending}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={46} minSize={30}>
            <CardTable
              query={query}
              page={page}
              onPageChange={setPage}
              selectedCardId={selectedCardId}
              onSelectCard={setSelectedCardId}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={27} minSize={18}>
            <NotePreview card={selectedCard} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
