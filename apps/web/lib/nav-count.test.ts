import { describe, expect, it } from "vitest";
import { formatCount } from "./nav-count";

describe("formatCount", () => {
  it("hides zero and negative counts", () => {
    expect(formatCount(0)).toBeNull();
    expect(formatCount(-1)).toBeNull();
  });

  it("caps at 99+", () => {
    expect(formatCount(3)).toBe("3");
    expect(formatCount(99)).toBe("99");
    expect(formatCount(100)).toBe("99+");
  });
});
