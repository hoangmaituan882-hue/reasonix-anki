/**
 * 牌组浏览器工具函数：树构建、due 语义、文本提取
 */
import type { CardInfo } from "../../lib/anki/schemas";

export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 正面摘要：order 最小的字段，剥 HTML 后截断 */
export function frontText(card: CardInfo, max = 80): string {
  const first = Object.values(card.fields).sort((a, b) => a.order - b.order)[0];
  const text = first ? stripHtml(first.value) : stripHtml(card.question);
  if (!text) return "（空）";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * due 语义标签：
 * queue -1 暂停 / -2、-3 埋没 / type 0 新卡 / 学习态归"学习中"。
 * 注意：复习卡（queue 2）的 due 是自集合创建起的"绝对天数编号"，
 * 换算日期需要集合创建时间（AnkiConnect 未提供），M1 只显示状态。
 */
export function dueLabel(card: CardInfo): string {
  if (card.queue === -1) return "已暂停";
  if (card.queue === -2 || card.queue === -3) return "已埋没";
  if (card.type === 0) return "新卡";
  if (card.type === 1 || card.queue === 1 || card.queue === 3) return "学习中";
  return "复习";
}

export interface DeckNode {
  name: string;
  fullName: string;
  children: DeckNode[];
}

/** "A::B::C" 扁平牌组名 → 层级树 */
export function buildDeckTree(names: string[]): DeckNode[] {
  const root: DeckNode[] = [];
  const map = new Map<string, DeckNode>();
  for (const full of [...names].sort((a, b) => a.localeCompare(b, "zh-CN"))) {
    const parts = full.split("::");
    let siblings = root;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}::${part}` : part;
      let node = map.get(path);
      if (!node) {
        node = { name: part, fullName: path, children: [] };
        map.set(path, node);
        siblings.push(node);
      }
      siblings = node.children;
    }
  }
  return root;
}
