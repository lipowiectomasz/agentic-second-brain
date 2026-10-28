import { describe, expect, it } from "vitest";
import { isLocked, prefixPolicy, registerFailure } from "./failure-window";

const start = new Date("2026-10-28T10:00:00Z");
const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

describe("failure window", () => {
  it("locks on the limit-th failure inside the window", () => {
    let state = null;
    for (let attempt = 1; attempt < prefixPolicy.limit; attempt += 1) {
      state = registerFailure(state, prefixPolicy, at(attempt));
      expect(isLocked(state, at(attempt))).toEqual({ locked: false });
    }
    state = registerFailure(state, prefixPolicy, at(5));
    expect(isLocked(state, at(5))).toEqual({ locked: true, retryAfterSeconds: 900 });
    expect(isLocked(state, at(10))).toEqual({ locked: true, retryAfterSeconds: 600 });
    expect(isLocked(state, at(20))).toEqual({ locked: false });
  });

  it("starts a new window after fifteen minutes", () => {
    const first = registerFailure(null, prefixPolicy, at(0));
    const later = registerFailure({ ...first, count: 4 }, prefixPolicy, at(15));
    expect(later).toEqual({ count: 1, windowStart: at(15), lockedUntil: null });
  });
});
