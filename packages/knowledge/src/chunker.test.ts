import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "./chunker";

const paragraph = (label: string, length: number) => `${label} ${"lorem ipsum ".repeat(Math.ceil(length / 12))}`.slice(0, length);
const small = { targetChars: 300, hardMaxChars: 600, minChars: 40, overlapMaxChars: 120 };

describe("chunkMarkdown", () => {
  it("returns nothing for an empty body", () => {
    expect(chunkMarkdown("  \n\n ")).toEqual([]);
  });

  it("gives text without headings the file title as heading", () => {
    expect(chunkMarkdown(paragraph("intro", 300), small, "Guide")).toEqual([{ index: 0, heading: "Guide", text: paragraph("intro", 300).trim() }]);
  });

  it("splits on H1 to H3 with a heading path and keeps H4 inside", () => {
    const body = `# Deploy\n${paragraph("a", 100)}\n## Rollback\n${paragraph("b", 100)}\n#### Detail\n${paragraph("c", 60)}\n### Database\n${paragraph("d", 100)}\n`;
    const chunks = chunkMarkdown(body, small);
    expect(chunks.map((chunk) => chunk.heading)).toEqual(["Deploy", "Deploy > Rollback", "Deploy > Rollback > Database"]);
    expect(chunks[1]?.text).toContain("#### Detail");
  });

  it("ignores headings inside fences", () => {
    const body = `# Real\n${paragraph("a", 80)}\n\`\`\`md\n# not a heading\n\`\`\`\n${paragraph("b", 80)}\n`;
    expect(chunkMarkdown(body, small).map((chunk) => chunk.heading)).toEqual(["Real"]);
  });

  it("merges a short section into the next one", () => {
    const body = `# A\nshort\n## B\n${paragraph("b", 120)}\n`;
    const chunks = chunkMarkdown(body, small);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain("short");
    expect(chunks[0]?.heading).toBe("A > B");
  });

  it("splits a long section at blank lines with overlap of the last paragraph", () => {
    const body = `# Long\n${[1, 2, 3, 4, 5, 6].map((n) => paragraph(`p${n}`, 100)).join("\n\n")}\n`;
    const chunks = chunkMarkdown(body, small);
    expect(chunks.length).toBeGreaterThan(1);
    const lastOfFirst = chunks[0]?.text.split("\n\n").pop() ?? "";
    expect(chunks[1]?.text.startsWith(lastOfFirst)).toBe(true);
    expect(chunks.every((chunk) => chunk.text.length <= small.hardMaxChars)).toBe(true);
  });

  it("splits a fenced block over the hard limit by lines", () => {
    const code = Array.from({ length: 40 }, (_, n) => `const value${n} = ${n};`).join("\n");
    const chunks = chunkMarkdown(`# Code\n\`\`\`ts\n${code}\n\`\`\`\n`, small);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= small.hardMaxChars)).toBe(true);
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, n) => n));
  });

  it("normalises CRLF", () => {
    expect(chunkMarkdown(`# A\r\n${paragraph("x", 80)}\r\n`, small)[0]?.text.includes("\r")).toBe(false);
  });
});
