import { describe, expect, it } from "vitest";
import { runPool } from "./pool";

describe("runPool", () => {
  it("never runs more than the pool size at once and keeps per-item errors", async () => {
    let running = 0;
    let peak = 0;
    const results = await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      if (value === 4) throw new Error("four");
      return value * 2;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(results.map((entry) => entry.result ?? (entry.error as Error).message)).toEqual([2, 4, 6, "four", 10, 12, 14]);
  });
});
