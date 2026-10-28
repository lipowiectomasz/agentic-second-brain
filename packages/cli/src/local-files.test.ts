import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { maxFileBytes, scanLocalFiles } from "./local-files";

describe("scanLocalFiles", () => {
  it("lists markdown files and skips state, git, indexes, symlinks and other files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cortex-scan-"));
    for (const dir of ["standards", "brains/atlas/specs", ".cortex/quarantine", ".git", "node_modules/x"]) await mkdir(path.join(root, dir), { recursive: true });
    await writeFile(path.join(root, "standards/a.md"), "# A\n");
    await writeFile(path.join(root, "brains/atlas/specs/SPEC-001-x.md"), "# X\n");
    await writeFile(path.join(root, "brains/atlas/_INDEX.md"), "index");
    await writeFile(path.join(root, ".cortex/quarantine/leak.md"), "x");
    await writeFile(path.join(root, ".git/HEAD.md"), "x");
    await writeFile(path.join(root, "notes.txt"), "x");
    await writeFile(path.join(root, "big.md"), "x".repeat(maxFileBytes + 1));
    await symlink(path.join(root, "standards/a.md"), path.join(root, "link.md"));
    const files = await scanLocalFiles(root);
    expect(files.map((file) => [file.path, file.tooLarge])).toEqual([
      ["big.md", true],
      ["brains/atlas/specs/SPEC-001-x.md", false],
      ["standards/a.md", false],
    ]);
  });
});
