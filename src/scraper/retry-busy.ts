import { setTimeout } from "node:timers/promises";
import { ScrapeBusyError } from "../sources/run";

// The manual refresh function has a 60-second execution limit.
export async function retryScrapeBusy<T>(
  collect: () => Promise<T>,
  { waitMs = 75_000, intervalMs = 5_000 }: { waitMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = performance.now() + waitMs;
  for (;;) {
    try {
      return await collect();
    } catch (error) {
      if (!(error instanceof ScrapeBusyError)) throw error;
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        throw new Error("다른 수집 작업의 잠금이 대기 시간 내에 해제되지 않았습니다", { cause: error });
      }
      await setTimeout(Math.min(intervalMs, remaining));
    }
  }
}
