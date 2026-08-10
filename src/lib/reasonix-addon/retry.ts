const MAX_BACKOFF_MS = 30_000;

export interface RetryOptions {
  maxAttempts?: number;
  sleep?: (delayMs: number) => Promise<void>;
  shouldRetry?: (error: unknown) => boolean;
}

export function retryDelayMs(retryIndex: number): number {
  const normalized = Math.max(0, Math.floor(retryIndex));
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** normalized);
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function defaultShouldRetry(error: unknown): boolean {
  const retryable = (error as { retryable?: unknown } | null)?.retryable;
  return retryable !== false;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  {
    maxAttempts = 4,
    sleep = defaultSleep,
    shouldRetry = defaultShouldRetry,
  }: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.floor(maxAttempts));
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts - 1 || !shouldRetry(error)) throw error;
      await sleep(retryDelayMs(attempt));
      attempt += 1;
    }
  }
}
