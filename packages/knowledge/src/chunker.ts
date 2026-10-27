import { normalizeLineEndings } from "@cortex/core";

export interface Chunk {
  index: number;
  heading: string;
  text: string;
}

export interface ChunkerOptions {
  targetChars: number;
  hardMaxChars: number;
  minChars: number;
  overlapMaxChars: number;
}

export const defaultChunkerOptions: ChunkerOptions = { targetChars: 3000, hardMaxChars: 6000, minChars: 200, overlapMaxChars: 600 };

interface Section {
  heading: string;
  level: number;
  lines: string[];
}

interface Block {
  text: string;
}

const headingPattern = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const fencePattern = /^(`{3,}|~{3,})/;

function isFenceToggle(line: string, open: string | null): { toggles: boolean; marker: string } {
  const match = fencePattern.exec(line);
  if (match === null) return { toggles: false, marker: "" };
  const marker = match[1] ?? "";
  if (open === null) return { toggles: true, marker };
  return { toggles: marker[0] === open[0] && marker.length >= open.length, marker };
}

function splitSections(body: string, title: string): Section[] {
  const sections: Section[] = [];
  const stack: string[] = [];
  let current: Section = { heading: title, level: 0, lines: [] };
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const toggle = isFenceToggle(line, fence);
    if (toggle.toggles) {
      fence = fence === null ? toggle.marker : null;
      current.lines.push(line);
      continue;
    }
    const heading = fence === null ? headingPattern.exec(line) : null;
    if (heading !== null) {
      const level = (heading[1] ?? "#").length;
      stack.length = level - 1;
      stack[level - 1] = (heading[2] ?? "").trim();
      sections.push(current);
      current = { heading: stack.filter((part) => part !== undefined && part !== "").join(" > ").slice(0, 256), level, lines: [line] };
      continue;
    }
    current.lines.push(line);
  }
  sections.push(current);
  return sections.filter((section) => section.lines.join("\n").trim() !== "");
}

function mergeShortSections(sections: Section[], minChars: number): Section[] {
  const result: Section[] = [];
  let pending: Section | null = null;
  for (const section of sections) {
    if (pending !== null) {
      if (section.level >= pending.level || pending.level === 0) {
        section.lines = [...pending.lines, "", ...section.lines];
        if (pending.level !== 0 && pending.level < section.level) {
          section.heading = pending.heading;
          section.level = pending.level;
        }
      } else {
        result.push(pending);
      }
      pending = null;
    }
    if (section.lines.join("\n").trim().length < minChars) {
      pending = section;
      continue;
    }
    result.push(section);
  }
  if (pending !== null) {
    const previous = result[result.length - 1];
    if (previous === undefined) result.push(pending);
    else previous.lines = [...previous.lines, "", ...pending.lines];
  }
  return result;
}

function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let fence: string | null = null;
  for (const line of text.split("\n")) {
    const toggle = isFenceToggle(line, fence);
    if (toggle.toggles) fence = fence === null ? toggle.marker : null;
    if (fence === null && !toggle.toggles && line.trim() === "") {
      if (buffer.length > 0) blocks.push({ text: buffer.join("\n") });
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  if (buffer.length > 0) blocks.push({ text: buffer.join("\n") });
  return blocks;
}

function splitOversizedBlock(text: string, hardMaxChars: number): string[] {
  if (text.length <= hardMaxChars) return [text];
  const pieces: string[] = [];
  let buffer = "";
  for (const line of text.split("\n")) {
    if (line.length > hardMaxChars) {
      if (buffer !== "") pieces.push(buffer);
      buffer = "";
      for (let start = 0; start < line.length; start += hardMaxChars) pieces.push(line.slice(start, start + hardMaxChars));
      continue;
    }
    const candidate = buffer === "" ? line : `${buffer}\n${line}`;
    if (candidate.length > hardMaxChars) {
      pieces.push(buffer);
      buffer = line;
    } else {
      buffer = candidate;
    }
  }
  if (buffer !== "") pieces.push(buffer);
  return pieces;
}

function splitSection(text: string, options: ChunkerOptions): string[] {
  if (text.length <= options.targetChars) return [text];
  const pieces = splitBlocks(text).flatMap((block) => splitOversizedBlock(block.text, options.hardMaxChars));
  const chunks: string[] = [];
  let buffer = "";
  let lastPiece = "";
  for (const piece of pieces) {
    const candidate = buffer === "" ? piece : `${buffer}\n\n${piece}`;
    if (buffer !== "" && candidate.length > options.targetChars) {
      chunks.push(buffer);
      const overlap = lastPiece.length <= options.overlapMaxChars ? lastPiece : "";
      buffer = overlap === "" || `${overlap}\n\n${piece}`.length > options.hardMaxChars ? piece : `${overlap}\n\n${piece}`;
    } else {
      buffer = candidate;
    }
    lastPiece = piece;
  }
  if (buffer !== "") chunks.push(buffer);
  return chunks;
}

export function chunkMarkdown(body: string, options: ChunkerOptions = defaultChunkerOptions, title = ""): Chunk[] {
  const normalized = normalizeLineEndings(body);
  if (normalized.trim() === "") return [];
  const sections = mergeShortSections(splitSections(normalized, title), options.minChars);
  const chunks: Chunk[] = [];
  for (const section of sections) {
    for (const text of splitSection(section.lines.join("\n").trim(), options)) {
      chunks.push({ index: chunks.length, heading: section.heading, text });
    }
  }
  return chunks;
}
