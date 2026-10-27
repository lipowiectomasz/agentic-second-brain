import { describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "./timeout";

describe("withTimeout", () => {
  it("returns the result when the operation finishes in time", async () => {
    await expect(withTimeout("fast", async () => 42, 100)).resolves.toBe(42);
  });

  it("rejects with TimeoutError naming the operation", async () => {
    const slow = () => new Promise<never>(() => undefined);
    await expect(withTimeout("tables.list", slow, 10)).rejects.toThrowError(TimeoutError);
    await expect(withTimeout("tables.list", slow, 10)).rejects.toThrowError("tables.list timed out after 10 ms");
  });
});
