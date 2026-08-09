import { CalendarClock, MoreHorizontal, PauseCircle, PlayCircle, SquarePen, Trash2 } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from "@reasonix/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { anki } from "../../lib/anki/actions";
import { queryKeys } from "../../lib/anki/query";
import type { CardInfo } from "../../lib/anki/schemas";
import { toast, toastError } from "../../components/ToasterLite";
import { useEditorStore } from "../../stores/editor";

/** 写操作后统一失效查询层缓存 */
function useInvalidateBrowse() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.decks });
    qc.invalidateQueries({ queryKey: queryKeys.cardsPrefix });
  };
}

/**
 * 行操作菜单：暂停/恢复 · 改期 · 删除（技术方案 §5.1 行操作）
 * 改期/删除均为明确确认后才触达 Anki 调度数据。
 */
export function RowActions({ card }: { card: CardInfo }) {
  const invalidate = useInvalidateBrowse();
  const openEditor = useEditorStore((s) => s.openEditor);
  const suspended = card.queue === -1;

  const [dueOpen, setDueOpen] = useState(false);
  const [days, setDays] = useState("1");
  const [delOpen, setDelOpen] = useState(false);

  const suspendMut = useMutation({
    mutationFn: () =>
      suspended ? anki.unsuspend([card.cardId]) : anki.suspend([card.cardId]),
    onSuccess: () => {
      toast({ title: suspended ? "已恢复卡片" : "已暂停卡片" });
      invalidate();
    },
    onError: (e) => toastError("操作失败", e),
  });

  const dueMut = useMutation({
    mutationFn: () => anki.setDueDate([card.cardId], days.trim()),
    onSuccess: () => {
      toast({ title: `已改期：${days.trim()}` });
      setDueOpen(false);
      invalidate();
    },
    onError: (e) => toastError("改期失败", e),
  });

  const delMut = useMutation({
    mutationFn: () => anki.deleteNotes([card.note]),
    onSuccess: () => {
      toast({ title: "已删除笔记及其卡片" });
      setDelOpen(false);
      invalidate();
    },
    onError: (e) => toastError("删除失败", e),
  });

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="卡片操作">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => suspendMut.mutate()}>
            {suspended ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
            {suspended ? "恢复" : "暂停"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEditor(card.note)}>
            <SquarePen className="h-4 w-4" />
            编辑…
          </DropdownMenuItem>

          <Dialog open={dueOpen} onOpenChange={setDueOpen}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setDueOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              改期…
            </DropdownMenuItem>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>改期到…</DialogTitle>
                <DialogDescription>
                  支持 Anki 语法：0 今天 · 1 明天 · 3-7 随机区间 · 1! 同时重置间隔
                </DialogDescription>
              </DialogHeader>
              <Alert>
                <AlertDescription>
                  将真实修改 Anki 调度；若该卡是新卡，会被转为复习卡。
                </AlertDescription>
              </Alert>
              <Input
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="1"
                aria-label="改期天数"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDueOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={() => dueMut.mutate()}
                  disabled={!days.trim() || dueMut.isPending}
                >
                  {dueMut.isPending ? "改期中…" : "确认改期"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenuSeparator />

          <Dialog open={delOpen} onOpenChange={setDelOpen}>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => e.preventDefault()}
              onClick={() => setDelOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              删除…
            </DropdownMenuItem>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>删除笔记？</DialogTitle>
                <DialogDescription>
                  将删除该笔记（# {card.note}）及其全部卡片，此操作会写入 Anki 数据库。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDelOpen(false)}>
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => delMut.mutate()}
                  disabled={delMut.isPending}
                >
                  {delMut.isPending ? "删除中…" : "确认删除"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
