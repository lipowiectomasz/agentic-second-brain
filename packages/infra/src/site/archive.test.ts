import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listSiteFiles, packSite, SiteDeployError, shouldPack } from "./archive";

describe("shouldPack", () => {
  it("keeps sources and drops build output, dependencies and tests", () => {
    expect(shouldPack("apps/web/app/page.tsx")).toBe(true);
    expect(shouldPack("packages/core/src/index.ts")).toBe(true);
    expect(shouldPack("apps/web/node_modules/x/index.js")).toBe(false);
    expect(shouldPack("apps/web/.next/server/app.js")).toBe(false);
    expect(shouldPack("apps/web/tests/e2e/auth.spec.ts")).toBe(false);
    expect(shouldPack("packages/infra/test/setup.integration.test.ts")).toBe(false);
    expect(shouldPack("packages/core/src/paths.test.ts")).toBe(false);
  });
});

describe("packSite", () => {
  let root: string;
  let out: string;

  async function file(relative: string, content: string) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), content);
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "site-root-"));
    out = await mkdtemp(path.join(tmpdir(), "site-out-"));
    await file("package.json", "{}");
    await file("package-lock.json", "{}");
    await file("apps/web/app/page.tsx", "export default 1");
    await file("packages/core/src/index.ts", "export {}");
    await file("docker/tools.Dockerfile", "FROM node");
    await file(".env", "SECRET=1");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
  });

  it("packs only the allowlisted roots, never the root env file", async () => {
    expect(await listSiteFiles(root)).toEqual(["apps/web/app/page.tsx", "package-lock.json", "package.json", "packages/core/src/index.ts"]);
  });

  it("gives a stable hash that follows content", async () => {
    const first = await packSite(root, out);
    const second = await packSite(root, out);
    expect(second.hash).toBe(first.hash);
    await file("packages/core/src/index.ts", "export const a = 1");
    expect((await packSite(root, out)).hash).not.toBe(first.hash);
  });

  it("refuses an env file inside a packed root", async () => {
    await file("apps/web/.env.local", "SECRET=1");
    await expect(listSiteFiles(root)).rejects.toBeInstanceOf(SiteDeployError);
  });
});
