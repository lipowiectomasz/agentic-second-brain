import { describe, expect, it } from "vitest";
import { longDate, shortDate } from "./dates";

describe("dates", () => {
  it("formats a short day and month", () => {
    expect(shortDate("2026-10-24T10:00:00Z")).toBe("24 Oct");
  });

  it("formats a long date", () => {
    expect(longDate("2026-10-22T23:30:00Z")).toBe("22 Oct 2026");
  });
});
