import type { AuditEvent } from "@cortex/core";
import type { SecretFinding } from "@cortex/core/secrets";

const limits = { target: 512, detail: 256, actorName: 128 } as const;

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`;
}

export function sanitizeEvent(event: AuditEvent, scan: (text: string) => SecretFinding[]): { event: AuditEvent; redacted: boolean } {
  let redacted = false;
  const clean = (value: string, limit: number): string => {
    if (scan(value).length > 0) {
      redacted = true;
      return "[redacted]";
    }
    return truncate(value, limit);
  };
  const result: AuditEvent = { ...event, actorName: truncate(event.actorName, limits.actorName), target: clean(event.target, limits.target) };
  if (event.detail !== undefined) result.detail = clean(event.detail, limits.detail);
  return { event: result, redacted };
}
