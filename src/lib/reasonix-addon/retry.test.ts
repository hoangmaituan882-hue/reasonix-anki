import { describe, expect, it, vi } from "vitest";
import { retryDelayMs, withRetry } from "./retry";

describe("reasonix retry policy", () => {
  it("uses bounded exponential backoff", () => {
    expect(retryDelayMs(0)).toBe(1000);
    expect(retryDelayMs(1)).toBe(2000);
    expect(retryDelayMs(4)).toBe(16000);
    expect(retryDelayMs(8)).toBe(30000);
  });

  it("retries transient failures and stops after the attempt budget", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("busy"))
      .mockResolvedValue("ok");
    const sleep = vi.fn(async () => undefined);

    await expect(
      withRetry(operation, { maxAttempts: 3, sleep }),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it("does not retry an explicitly non-retryable failure", async () => {
    const error = Object.assign(new Error("denied"), { retryable: false });
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);
    const sleep = vi.fn(async () => undefined);

    await expect(withRetry(operation, { maxAttempts: 4, sleep })).rejects.toBe(
      error,
    );
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
