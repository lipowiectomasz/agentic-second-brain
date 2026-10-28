import { chmod, mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readCredentials, writeCredentials } from "./credentials";

const value = { schema: 1 as const, endpoint: "http://localhost:18080/v1", projectId: "cortex", functionId: "cli-gateway", token: `cbt_abcdefgh_${"A".repeat(43)}`, userId: "u1", name: "Ada", scope: "read" as const, expiresAt: "2026-11-01T00:00:00.000Z" };

describe("credentials", () => {
  it("writes the file with mode 0600 in a 0700 directory and reads it back", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cortex-cred-"));
    const file = path.join(dir, "cortex", "credentials.json");
    await writeCredentials(file, value);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(file))).mode & 0o777).toBe(0o700);
    expect(await readCredentials(file)).toEqual(value);
  });

  it("refuses a file readable by group or others", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cortex-cred-"));
    const file = path.join(dir, "credentials.json");
    await writeCredentials(file, value);
    await chmod(file, 0o644);
    await expect(readCredentials(file)).rejects.toThrow("chmod 600");
  });
});
