import DOMPurify from "dompurify";
import { Eye, EyeOff } from "lucide-react";
import { Button, Label, Textarea } from "@reasonix/ui";
import { useRef, useState, type ClipboardEvent } from "react";
import { anki } from "../../lib/anki/actions";
import { toastError } from "../../components/ToasterLite";

function fileToBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  });
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

/**
 * 字段编辑器（技术方案 §5.2）：HTML 源码编辑 + 实时消毒预览 + 图片粘贴上传
 * 粘贴的图片走 storeMediaFile 存入 Anki 媒体目录，并在光标处插入 <img>。
 */
export function FieldEditor({ label, value, onChange, rows = 5 }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) return; // 非图片走默认粘贴
    e.preventDefault();
    setUploading(true);
    try {
      const el = ref.current;
      let next = value;
      let cursor = el?.selectionStart ?? next.length;
      for (const file of files) {
        const data = await fileToBase64(file);
        const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
        const filename = `paste_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        await anki.storeMediaFile(filename, data);
        const tag = `<img src="${filename}">`;
        next = next.slice(0, cursor) + tag + next.slice(cursor);
        cursor += tag.length;
      }
      onChange(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(cursor, cursor);
      });
    } catch (err) {
      toastError("图片上传失败", err);
    } finally {
      setUploading(false);
    }
  };

  // 预览经 DOMPurify 消毒；媒体文件名引用要等 M3 媒体管线才能显示
  const sanitized = DOMPurify.sanitize(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
          {uploading && (
            <span className="text-2xs text-[var(--rx-fg-faint)]">上传中…</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-2xs rx-press"
            onClick={() => setShowPreview((p) => !p)}
          >
            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showPreview ? "源码" : "预览"}
          </Button>
        </div>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        rows={rows}
        className="mono text-xs leading-relaxed"
        placeholder="支持 HTML；截图可直接粘贴上传"
      />
      {showPreview && (
        <div
          className="max-h-56 overflow-y-auto rounded-[var(--rx-r-m)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] p-3 text-sm"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )}
    </div>
  );
}
