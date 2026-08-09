/**
 * 查询层 hooks（技术方案 §2.3：查询型数据归 TanStack Query）
 */
import { useQuery } from "@tanstack/react-query";
import { anki } from "./actions";
import type { CardInfo, DeckConfig, DeckMap, DeckStats } from "./schemas";

export const PAGE_SIZE = 50;

export const queryKeys = {
  decks: ["decks"] as const,
  deckConfigs: (names: string[]) => ["deckConfigs", names.join("\u0000")] as const,
  cards: (query: string, page: number) => ["cards", query, page] as const,
  cardsPrefix: ["cards"] as const,
  note: (id: number) => ["note", id] as const,
};

export interface DeckTreeData {
  /** 牌组名 → deck_id（deckNamesAndIds 真实返回结构） */
  decks: DeckMap;
  /** key = deck_id 字符串（getDeckStats 原始口径） */
  stats: Record<string, DeckStats>;
}

/** 牌组列表 + 今日额度计数 */
export function useDeckTree() {
  return useQuery({
    queryKey: queryKeys.decks,
    queryFn: async (): Promise<DeckTreeData> => {
      const decks = await anki.deckNamesAndIds();
      const names = Object.keys(decks);
      const stats = names.length ? await anki.getDeckStats(names) : {};
      return { decks, stats };
    },
  });
}

/** 各牌组每日上限（并行拉取，长缓存；牌组 config 很少变动） */
export function useDeckConfigs(deckNames: string[]) {
  return useQuery({
    queryKey: queryKeys.deckConfigs(deckNames),
    queryFn: async (): Promise<Record<string, DeckConfig>> => {
      const entries = await Promise.all(
        deckNames.map(async (name) => {
          try {
            return [name, await anki.getDeckConfig(name)] as const;
          } catch {
            return [name, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries.filter((e): e is [string, DeckConfig] => e[1] !== null));
    },
    enabled: deckNames.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export interface CardPage {
  cards: CardInfo[];
  total: number;
  page: number;
}

/** 卡片搜索：findCards 全量 id → 分页切片 → 仅对当页 cardsInfo（技术方案 §7） */
export function useCardSearch(query: string, page: number) {
  return useQuery({
    queryKey: queryKeys.cards(query, page),
    queryFn: async (): Promise<CardPage> => {
      const ids = await anki.findCards(query);
      const slice = ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      const cards = slice.length ? await anki.cardsInfo(slice) : [];
      return { cards, total: ids.length, page };
    },
    enabled: query.trim().length > 0,
  });
}

/** 右栏笔记预览 */
export function useNotePreview(noteId: number | null) {
  return useQuery({
    queryKey: queryKeys.note(noteId ?? -1),
    queryFn: async () => {
      const [note] = await anki.notesInfo([noteId as number]);
      return note ?? null;
    },
    enabled: noteId != null,
  });
}

/** 模型名列表（M2 新建笔记） */
export function useModelNames() {
  return useQuery({
    queryKey: ["models"] as const,
    queryFn: () => anki.modelNames(),
    staleTime: 10 * 60 * 1000,
  });
}

/** 指定模型的字段名列表（M2 动态表单） */
export function useModelFields(modelName: string | null) {
  return useQuery({
    queryKey: ["modelFields", modelName ?? ""] as const,
    queryFn: () => anki.modelFieldNames(modelName as string),
    enabled: modelName != null,
  });
}
