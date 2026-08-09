import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@reasonix/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { anki } from "../../lib/anki/actions";
import {
  queryKeys,
  useDeckTree,
  useModelFields,
  useModelNames,
} from "../../lib/anki/query";
import { toast, toastError } from "../../components/ToasterLite";
import { useEditorStore } from "../../stores/editor";
import { FieldEditor } from "./FieldEditor";

/**
 * 新建笔记 Dialog（技术方案 §5.2）：选牌组 + 模型 → modelFieldNames 动态表单 → addNote
 */
export function NewNoteDialog() {
  const { newNoteOpen, closeNewNote, newNoteDefaultDeck } = useEditorStore();

  return (
    <Dialog
      open={newNoteOpen}
      onOpenChange={(next) => {
        if (!next) closeNewNote();
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[560px] flex-col p-0">
        {newNoteOpen && <NewNoteForm defaultDeck={newNoteDefaultDeck} onDone={closeNewNote} />}
      </DialogContent>
    </Dialog>
  );
}

function NewNoteForm({
  defaultDeck,
  onDone,
}: {
  defaultDeck: string | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const decksQ = useDeckTree();
  const modelsQ = useModelNames();
  const deckNames = Object.keys(decksQ.data?.decks ?? {});

  const [deck, setDeck] = useState<string>(defaultDeck ?? deckNames[0] ?? "");
  const [model, setModel] = useState<string>("");
  const [tags, setTags] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  // deckNames 异步到位后补默认值
  useEffect(() => {
    if (!deck && deckNames.length > 0) setDeck(defaultDeck ?? deckNames[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckNames.length]);

  const fieldsQ = useModelFields(model || null);

  const addMut = useMutation({
    mutationFn: () =>
      anki.addNote({
        deckName: deck,
        modelName: model,
        fields: values,
        tags: tags
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    onSuccess: (noteId) => {
      if (noteId == null) {
        toastError("添加失败", new Error("Anki 拒绝了该笔记（常见原因：与现有卡片重复）"));
        return;
      }
      toast({ title: "已创建笔记", description: `# ${noteId} → ${deck}` });
      qc.invalidateQueries({ queryKey: queryKeys.decks });
      qc.invalidateQueries({ queryKey: queryKeys.cardsPrefix });
      onDone();
    },
    onError: (e) => toastError("添加失败", e),
  });

  const ready = deck && model;

  return (
    <>
      <DialogHeader className="shrink-0 border-b border-[var(--rx-border-soft)] px-5 py-4 text-left">
        <DialogTitle>新建笔记</DialogTitle>
        <DialogDescription>
          选择牌组与模板后按字段填写；默认拒绝与现有卡片重复
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">牌组</Label>
            <Select value={deck} onValueChange={setDeck}>
              <SelectTrigger aria-label="选择牌组">
                <SelectValue placeholder="选择牌组" />
              </SelectTrigger>
              <SelectContent>
                {deckNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">模板（笔记类型）</Label>
            <Select
              value={model}
              onValueChange={(v) => {
                setModel(v);
                setValues({});
              }}
            >
              <SelectTrigger aria-label="选择模板">
                <SelectValue placeholder="选择模板" />
              </SelectTrigger>
              <SelectContent>
                {(modelsQ.data ?? []).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {model && fieldsQ.isPending && (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {(fieldsQ.data ?? []).map((name) => (
          <FieldEditor
            key={`${model}:${name}`}
            label={name}
            value={values[name] ?? ""}
            onChange={(v) => setValues((prev) => ({ ...prev, [name]: v }))}
          />
        ))}

        {model && !fieldsQ.isPending && (
          <div className="space-y-1.5">
            <Label className="text-xs">标签（逗号或空格分隔）</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2"
              className="mono text-xs"
            />
          </div>
        )}
      </div>

      <DialogFooter className="shrink-0 border-t border-[var(--rx-border-soft)] px-5 py-3">
        <Button variant="outline" onClick={onDone} className="rx-press">
          取消
        </Button>
        <Button
          onClick={() => addMut.mutate()}
          disabled={!ready || addMut.isPending}
          className="rx-press"
        >
          {addMut.isPending ? "添加中…" : "添加到 Anki"}
        </Button>
      </DialogFooter>
    </>
  );
}
