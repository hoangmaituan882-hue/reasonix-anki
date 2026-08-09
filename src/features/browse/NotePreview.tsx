import { Badge, Separator, Skeleton } from "@reasonix/ui";
import { useNotePreview } from "../../lib/anki/query";
import type { CardInfo } from "../../lib/anki/schemas";
import { stripHtml } from "./browseUtil";

/**
 * 右栏笔记预览：M1 为纯文本摘要（HTML 剥离），
 * 完整 HTML 沙箱渲染在 M3 复习视图落地（DOMPurify + iframe）。
 */
export function NotePreview({ card }: { card: CardInfo | null }) {
  const { data: note, isPending } = useNotePreview(card?.note ?? null);

  if (!card) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--rx-fg-faint)]">
        从列表选择一张卡片查看笔记
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="space-y-3 p-3" aria-label="加载中">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--rx-fg-faint)]">
        未找到笔记（# {card.note}）
      </div>
    );
  }

  const fields = Object.entries(note.fields)
    .sort(([, a], [, b]) => a.order - b.order);

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold">{note.modelName}</h2>
        <span className="mono shrink-0 text-2xs text-[var(--rx-fg-faint)]">
          #{note.noteId}
        </span>
      </div>

      {note.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-2xs font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Separator className="mb-2 bg-[var(--rx-border-soft)]" />

      <dl className="space-y-3">
        {fields.map(([name, field]) => {
          const text = stripHtml(field.value);
          return (
            <div key={name}>
              <dt className="mb-0.5 text-2xs font-medium text-[var(--rx-fg-faint)]">
                {name}
              </dt>
              <dd
                className="text-sm leading-relaxed text-[var(--rx-fg-dim)]"
                style={{ display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                title={text}
              >
                {text || "（空）"}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
