import { ID, Permission, Role } from "node-appwrite";
import type { TablesDB } from "node-appwrite";
import type { AuditEvent } from "@cortex/core";
import { adminLabel } from "@cortex/core";
import { scanForSecrets } from "@cortex/core/secrets";
import { withTimeout } from "@cortex/server-kit";
import { sanitizeEvent } from "./sanitize";

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

export const auditEventsTableId = "audit_events";

export function createTablesAuditSink(tables: Pick<TablesDB, "createRow">, ids: { tables: string }, options: { log?: (message: string) => void; retryDelayMs?: number } = {}): AuditSink {
  const log = options.log ?? ((message: string) => console.error(message));
  const retryDelayMs = options.retryDelayMs ?? 300;
  return {
    async record(raw) {
      const { event, redacted } = sanitizeEvent(raw, scanForSecrets);
      if (redacted) log(`audit event redacted: ${event.action}`);
      const write = () =>
        withTimeout("tablesDB.createRow audit", () =>
          tables.createRow({
            databaseId: ids.tables,
            tableId: auditEventsTableId,
            rowId: ID.unique(),
            data: { actorId: event.actorId, actorName: event.actorName, action: event.action, channel: event.channel, sectorId: event.sectorId ?? null, target: event.target, detail: event.detail ?? null },
            permissions: [Permission.read(Role.label(adminLabel))],
          }),
        );
      try {
        await write();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        try {
          await write();
        } catch {
          log(`audit write failed: ${event.action} ${event.target}`);
        }
      }
    },
  };
}
