/**
 * 兼容复习流状态机测试：answer 并发守卫与跨会话竞态（审查修复 S1 防回归）。
 * answer in-flight 期间退出/重启会话，旧评分不得污染新会话。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReviewStore } from "./review";
import type { CardInfo } from "../lib/anki/schemas";

const ankiMock = vi.hoisted(() => ({
  answerCards: vi.fn(),
  findCards: vi.fn(),
  cardsInfo: vi.fn(),
}));

vi.mock("../lib/anki/actions", () => ({ anki: ankiMock }));
vi.mock("../components/ToasterLite", () => ({
  toast: vi.fn(),
  toastError: vi.fn(),
}));

function card(id: number): CardInfo {
  return {
    cardId: id,
    question: `q${id}`,
    answer: `a${id}`,
    deckName: "测试牌组",
    modelName: "Basic",
    fields: {},
    type: 2,
    queue: 2,
    due: 0,
  } as CardInfo;
}

describe("review store 并发守卫", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReviewStore.setState({
      deck: null,
      queue: [],
      index: 0,
      phase: "idle",
      answered: [],
      buriedSession: [],
      starting: false,
      answering: false,
      error: null,
    });
    ankiMock.findCards.mockResolvedValue([1, 2]);
    ankiMock.cardsInfo.mockResolvedValue([card(1), card(2)]);
    ankiMock.answerCards.mockResolvedValue([true]);
  });

  it("answer in-flight 期间会话退出并重启，旧评分不推进新会话", async () => {
    const s = useReviewStore.getState();
    await s.start("测试牌组");
    s.reveal();
    expect(useReviewStore.getState().phase).toBe("answer");

    // 卡住第一次评分提交（不 resolve）
    let resolveAnswer!: (v: boolean[]) => void;
    ankiMock.answerCards.mockImplementationOnce(
      () => new Promise<boolean[]>((res) => (resolveAnswer = res)),
    );
    const pending = useReviewStore.getState().answer(3);
    expect(useReviewStore.getState().answering).toBe(true);

    // in-flight 期间退出会话 → 立即重开同一牌组
    useReviewStore.getState().exit();
    expect(useReviewStore.getState().answering).toBe(false);
    await useReviewStore.getState().start("测试牌组");
    expect(useReviewStore.getState().index).toBe(0);
    expect(useReviewStore.getState().answered).toHaveLength(0);

    // 旧评分此刻才完成：不得推进新会话 / 不得污染 answered
    resolveAnswer([true]);
    await pending;

    const after = useReviewStore.getState();
    expect(after.answered).toHaveLength(0);
    expect(after.index).toBe(0);
    expect(after.answering).toBe(false);
  });

  it("answer 失败复位 answering，停留在当前卡可重试", async () => {
    const s = useReviewStore.getState();
    await s.start("测试牌组");
    s.reveal();

    ankiMock.answerCards.mockRejectedValueOnce(new Error("超时"));
    await useReviewStore.getState().answer(3);

    const after = useReviewStore.getState();
    expect(after.answering).toBe(false);
    expect(after.index).toBe(0); // 停留原卡
    expect(after.answered).toHaveLength(0);
  });
});
