import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = path.resolve(import.meta.dirname, "..");
const css = readFileSync(path.join(webRoot, "app/globals.css"), "utf8");

function tokenBlock(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`missing ${selector}`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return new Map([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1] ?? "", match[2] ?? ""]));
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const surfaces = ["background", "surface", "surface-raised", "surface-sunken"];
const textTokens = ["foreground", "muted-foreground"];
const onSurfaceText = ["accent", "danger", "success", "warning", "info", ...Array.from({ length: 8 }, (_, index) => `sector-${index + 1}`)];

const themes = {
  light: tokenBlock(":root"),
  dark: tokenBlock(':root[data-theme="dark"]'),
};

describe.each(Object.entries(themes))("%s theme contrast", (_, tokens) => {
  const value = (name: string): string => {
    const hex = tokens.get(name);
    if (hex === undefined) throw new Error(`token ${name} is not a hex colour`);
    return hex;
  };

  it.each(textTokens.flatMap((text) => surfaces.map((surface) => [text, surface])))("%s on %s is at least 4.5:1", (text, surface) => {
    expect(contrast(value(text), value(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(onSurfaceText)("%s text on surface is at least 4.5:1", (text) => {
    expect(contrast(value(text), value("surface"))).toBeGreaterThanOrEqual(4.5);
  });

  it("accent foreground on accent is at least 4.5:1", () => {
    expect(contrast(value("accent-foreground"), value("accent"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["input", "ring"])("%s against the background is at least 3:1", (token) => {
    expect(contrast(value(token), value("background"))).toBeGreaterThanOrEqual(3);
  });
});

describe("dark tokens", () => {
  it("are the same for the explicit choice and the system preference", () => {
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(tokenBlock(':root[data-theme="dark"]')).toEqual(new Map([...media.slice(0, media.indexOf("\n}\n")).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1] ?? "", match[2] ?? ""])));
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !entry.endsWith(".test.ts") ? [full] : [];
  });
}

describe("colour literals", () => {
  it("live only in the stylesheet", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((directory) => sourceFiles(path.join(webRoot, directory)))
      .filter((file) => /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|-\[#/i.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(webRoot, file));
    expect(offenders).toEqual([]);
  });
});
