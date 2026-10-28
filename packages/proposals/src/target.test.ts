import { describe, expect, it } from "vitest";
import { validateTarget } from "./target";

describe("validateTarget", () => {
  it("accepts spine paths that match their kind", () => {
    expect(validateTarget({ kind: "standard", targetPath: "standards/core/release-checklist.md" })).toEqual({ ok: true, path: "standards/core/release-checklist.md" });
    expect(validateTarget({ kind: "procedure", targetPath: "procedures/on-call.md" })).toEqual({ ok: true, path: "procedures/on-call.md" });
  });

  it.each([
    [{ kind: "standard" as const, targetPath: "procedures/a.md" }, "kind_mismatch"],
    [{ kind: "standard" as const, targetPath: "standards/../secrets.md" }, "unsafe_path"],
    [{ kind: "standard" as const, targetPath: "/standards/a.md" }, "unsafe_path"],
    [{ kind: "standard" as const, targetPath: "standards/Upper.md" }, "unsafe_path"],
    [{ kind: "standard" as const, targetPath: "standards/a.txt" }, "unsafe_path"],
    [{ kind: "standard" as const, targetPath: "brains/atlas/a.md" }, "wrong_root"],
  ])("rejects %j", (input, reason) => {
    expect(validateTarget(input)).toEqual({ ok: false, reason });
  });
});
