export type SecretRuleId =
  | "aws-access-key"
  | "github-token"
  | "slack-token"
  | "private-key"
  | "jwt"
  | "appwrite-key"
  | "stripe-live-key"
  | "google-api-key"
  | "generic-assignment";

export interface SecretFinding {
  line: number;
  ruleId: SecretRuleId;
  preview: string;
}

const maxFindings = 20;
const minimumEntropy = 3.5;
const placeholder = /^(<.*>|x{4,}|\*{4,}|changeme|example|placeholder|your[-_].*|\$\{.*\})$/i;

const rules: Array<{ id: Exclude<SecretRuleId, "generic-assignment">; pattern: RegExp }> = [
  { id: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: "github-token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/g },
  { id: "slack-token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: "private-key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { id: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { id: "appwrite-key", pattern: /\bstandard_[a-f0-9]{128,}\b/g },
  { id: "stripe-live-key", pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g },
  { id: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
];

const genericAssignment = /(?:api[_-]?key|secret|passw(?:or)?d|token|auth)["']?\s*[:=]\s*["']?([^\s"'<>]{16,})/gi;

export function maskSecret(value: string): string {
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(Math.min(value.length - 8, 24))}${value.slice(-4)}`;
}

export function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

export function scanForSecrets(content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  for (const [index, line] of lines.entries()) {
    for (const rule of rules) {
      for (const match of line.matchAll(rule.pattern)) {
        findings.push({ line: index + 1, ruleId: rule.id, preview: maskSecret(match[0]) });
        if (findings.length >= maxFindings) return findings;
      }
    }
    for (const match of line.matchAll(genericAssignment)) {
      const value = match[1] ?? "";
      if (placeholder.test(value) || shannonEntropy(value) < minimumEntropy) continue;
      if (findings.some((finding) => finding.line === index + 1)) continue;
      findings.push({ line: index + 1, ruleId: "generic-assignment", preview: maskSecret(value) });
      if (findings.length >= maxFindings) return findings;
    }
  }
  return findings;
}
