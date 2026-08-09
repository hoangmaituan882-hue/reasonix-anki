import {
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@reasonix/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { anki } from "../../lib/anki/actions";
import { queryKeys, useNotePreview } from "../../lib/anki/query";
import { toast, toastError } from "../../components/ToasterLite";
import { useEditorStore } from "../../stores/editor";
import { FieldEditor } from "./FieldEditor";

/**
 * 笔记编辑 Sheet（技术方案 §5.2）：动态字段表单 + 标签，updateNote 一次提交。
 * 全局单实例挂在 App，由 editor store 驱动（行操作菜单 / EditorView 都能唤起）。
 */
export function NoteEditorSheet() {
  const { editingNoteId, closeEditor } = useEditorStore();
  const open = editingNoteId != null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeEditor();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-[560px] flex-col p-0 sm:max-w-[560px]"
      >
        {editingNoteId != null && (
          <EditorForm key={editingNoteId} noteId={editingNoteId} onDone={closeEditor} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditorForm({ noteId, onDone }: { noteId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: note, isPending } = useNotePreview(noteId);

  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [tags, setTags] = useState("");

  // 数据到位后初始化表单（key=noteId 保证换笔记时重置）
  useEffect(() => {
    if (note && fields === null) {
      setFields(
        Object.fromEntries(Object.entries(note.fields).map(([k, f]) => [k, f.value])),
      );
      setTags(note.tags.join(", "));
    }
  }, [note, fields]);

  const saveMut = useMutation({
    mutationFn: () =>
      anki.updateNote({
        id: noteId,
        fields: fields ?? undefined,
        tags: tags
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast({ title: "已保存笔记", description: `# ${noteId} 已写回 Anki` });
      qc.invalidateQueries({ queryKey: queryKeys.note(noteId) });
      qc.invalidateQueries({ queryKey: queryKeys.cardsPrefix });
      qc.invalidateQueries({ queryKey: queryKeys.decks });
      onDone();
    },
    onError: (e) => toastError("保存失败", e),
  });

  if (isPending || fields === null) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const orderedFields = Object.entries(note?.fields ?? {}).sort(
    ([, a], [, b]) => a.order - b.order,
  );

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-[var(--rx-border-soft)] px-5 py-4 text-left">
        <SheetTitle>
          编辑笔记 <span className="mono text-xs text-[var(--rx-fg-faint)]">#{noteId}</span>
        </SheetTitle>
        <SheetDescription>
          模板：{note?.modelName ?? "—"} · 修改将直接写入 Anki 数据库
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {orderedFields.map(([name]) => (
          <FieldEditor
            key={name}
            label={name}
            value={fields[name] ?? ""}
            onChange={(v) => setFields((prev) => ({ ...(prev ?? {}), [name]: v }))}
          />
        ))}

        <div className="space-y-1.5">
          <Label className="text-xs">标签（逗号或空格分隔）</Label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tag1, tag2"
            className="mono text-xs"
          />
        </div>
      </div>

      <SheetFooter className="shrink-0 border-t border-[var(--rx-border-soft)] px-5 py-3">
        <Button variant="outline" onClick={onDone} className="rx-press">
          取消
        </Button>
        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rx-press"
        >
          {saveMut.isPending ? "保存中…" : "保存到 Anki"}
        </Button>
      </SheetFooter>
    </>
  );
}
