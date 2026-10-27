import type { AuditEvent } from "@cortex/core";

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export const noopAuditSink: AuditSink = {
  async record() {
    return undefined;
  },
};

export class MemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}
