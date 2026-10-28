import { describe, expect, it } from "vitest";
import { scanForSecrets } from "@cortex/core/secrets";
import { sanitizeEvent } from "./sanitize";

const base = { actorId: "u1", actorName: "Ada", channel: "web" as const, action: "file.upserted" as const, target: "notes/a.md" };

describe("sanitizeEvent", () => {
  it("truncates long targets and details with an ellipsis", () => {
    const { event } = sanitizeEvent({ ...base, target: "t".repeat(600), detail: "d".repeat(300) }, scanForSecrets);
    expect(event.target).toHaveLength(512);
    expect(event.target.endsWith("...")).toBe(true);
    expect(event.detail).toHaveLength(256);
  });

  it("redacts a field that looks like a secret", () => {
    const result = sanitizeEvent({ ...base, target: "AKIAABCDEFGHIJKLMNOP", detail: "v2" }, scanForSecrets);
    expect(result).toEqual({ event: { ...base, target: "[redacted]", detail: "v2" }, redacted: true });
  });

  it("leaves ordinary events untouched", () => {
    expect(sanitizeEvent({ ...base, detail: "v3" }, scanForSecrets)).toEqual({ event: { ...base, detail: "v3" }, redacted: false });
  });
});
