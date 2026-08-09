/**
 * 编辑器全局状态：笔记编辑 Sheet 与新建 Dialog 跨层共享
 * （行操作菜单在 CardTable 深处，入口也可能在 EditorView）
 */
import { create } from "zustand";

interface EditorState {
  /** 正在编辑的笔记 id；null = 未打开 */
  editingNoteId: number | null;
  newNoteOpen: boolean;
  /** 新建对话框的默认牌组（从浏览器带入） */
  newNoteDefaultDeck: string | null;

  openEditor: (noteId: number) => void;
  closeEditor: () => void;
  openNewNote: (defaultDeck?: string | null) => void;
  closeNewNote: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  editingNoteId: null,
  newNoteOpen: false,
  newNoteDefaultDeck: null,

  openEditor: (noteId) => set({ editingNoteId: noteId }),
  closeEditor: () => set({ editingNoteId: null }),
  openNewNote: (defaultDeck = null) =>
    set({ newNoteOpen: true, newNoteDefaultDeck: defaultDeck }),
  closeNewNote: () => set({ newNoteOpen: false }),
}));
