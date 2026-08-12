/**
 * 今日首页的纯类型与工具函数（从 TodayView.tsx 拆出）。
 */

export interface TodayDeckRow {
  id: number;
  name: string;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  totalCount: number;
}

export function dueCount(deck: TodayDeckRow): number {
  return deck.newCount + deck.learningCount + deck.reviewCount;
}

export function summarizeTodayDecks(decks: readonly TodayDeckRow[]): {
  newCount: number;
  learningCount: number;
  reviewCount: number;
} {
  return decks
    .filter((deck) => !deck.name.includes("::"))
    .reduce(
      (sum, deck) => ({
        newCount: sum.newCount + deck.newCount,
        learningCount: sum.learningCount + deck.learningCount,
        reviewCount: sum.reviewCount + deck.reviewCount,
      }),
      { newCount: 0, learningCount: 0, reviewCount: 0 },
    );
}
