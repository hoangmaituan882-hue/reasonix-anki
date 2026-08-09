import { Plus, Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  InputGroup,
  InputGroupInput,
} from "@reasonix/ui";
import { useState } from "react";
import { toastError } from "../components/ToasterLite";
import { useEditorStore } from "../stores/editor";

/**
 * M2 笔记编辑入口视图：新建笔记 / 按 id 编辑
 * （真正的编辑面板是全局挂载的 NoteEditorSheet / NewNoteDialog）
 */
export function EditorView() {
  const { openNewNote, openEditor } = useEditorStore();
  const [noteIdInput, setNoteIdInput] = useState("");

  const openById = () => {
    const id = Number(noteIdInput.trim());
    if (!Number.isInteger(id) || id <= 0) {
      toastError(
        "无效的笔记 id",
        new Error("请输入数字形式的笔记 id（卡片列表右栏预览中可见）"),
      );
      return;
    }
    openEditor(id);
  };

  return (
    <div className="flex h-full items-start justify-center gap-4 p-8">
      <Card className="w-full max-w-sm rx-anim-modal">
        <CardHeader>
          <CardTitle>新建笔记</CardTitle>
          <CardDescription>
            选择牌组与模板后按字段填写，支持 HTML 与图片粘贴上传；默认拒绝重复卡。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => openNewNote()} className="rx-press">
            <Plus className="h-4 w-4" />
            打开新建对话框
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full max-w-sm rx-anim-modal">
        <CardHeader>
          <CardTitle>编辑已有笔记</CardTitle>
          <CardDescription>
            输入笔记 id 直接编辑；更推荐在牌组浏览器的行操作菜单里点"编辑"。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <InputGroup>
            <InputGroupInput
              value={noteIdInput}
              onChange={(e) => setNoteIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") openById();
              }}
              placeholder="笔记 id，如 1782031602405"
              className="mono text-xs"
              aria-label="笔记 id"
            />
          </InputGroup>
          <Button variant="outline" onClick={openById} className="rx-press">
            <Search className="h-4 w-4" />
            打开编辑面板
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
