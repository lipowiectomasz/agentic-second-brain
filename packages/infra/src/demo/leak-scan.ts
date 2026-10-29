import { scanForSecrets } from "@cortex/core";

export interface LeakFinding {
  file: string;
  line: number;
  reason: string;
}

export function parseDenylist(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

export function scanCorpus(files: Map<string, string>, denylist: string[]): LeakFinding[] {
  const terms = denylist.map((term) => term.toLowerCase());
  const findings: LeakFinding[] = [];
  for (const [file, content] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    for (const secret of scanForSecrets(content)) findings.push({ file, line: secret.line, reason: `secret ${secret.ruleId}` });
    content.split("\n").forEach((text, index) => {
      const lower = text.toLowerCase();
      for (const term of terms) if (lower.includes(term)) findings.push({ file, line: index + 1, reason: "denylisted term" });
    });
  }
  return findings;
}
