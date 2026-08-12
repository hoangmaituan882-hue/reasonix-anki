/**
 * 学习会话的纯工具与常量（从 studySession.ts 拆出，无副作用）。
 */

export const REQUIRED_CAPABILITIES = [
  "session.start",
  "session.next",
  "session.reveal",
  "session.answer",
  "session.undo",
  "session.finish",
] as const;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === code,
  );
}
