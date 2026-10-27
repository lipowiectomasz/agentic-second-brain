import type { AuditAction } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import type { AccessDeps } from "./types";

export async function recordAudit(
  deps: AccessDeps,
  caller: Caller,
  event: { action: AuditAction; target: string; sectorId?: string; detail?: string },
): Promise<void> {
  await deps.audit.record({ actorId: caller.userId, actorName: caller.name, channel: caller.channel, ...event });
}
