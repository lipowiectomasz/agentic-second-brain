import { describe, expect, it, vi } from "vitest";
import type { CommandEnv } from "./commands";
import { reserve } from "./commands";
import { CliError, exitCodes } from "./errors";

describe("reserve", () => {
  it("rejects a bad file slug before reserving an ID", async () => {
    const fetchImpl = vi.fn();
    const env = { root: "/tmp/brain", cwd: "/tmp/brain", credentialsFile: "/tmp/none.json", fetch: fetchImpl } as unknown as CommandEnv;
    const attempt = reserve(env, { sector: "browser-recorder", create: "test_run_check" }, "backlog");
    await expect(attempt).rejects.toBeInstanceOf(CliError);
    await expect(reserve(env, { create: "Bad Slug" }, "spec")).rejects.toMatchObject({ exitCode: exitCodes.usage });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
