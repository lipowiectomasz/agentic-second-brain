import type { Client } from "node-appwrite";
import type { AuditSink } from "@cortex/audit";
import type { DatabaseIds } from "@cortex/config";
import type { SectorRole } from "@cortex/core";
import type { Caller } from "@cortex/server-kit";
import type { Embedder } from "./embedder";

export interface AccessReader {
  getSectorRole(caller: Caller, sectorId: string): Promise<SectorRole | null>;
}

export interface KnowledgeWriteDeps {
  admin: Client;
  ids: DatabaseIds;
  access: AccessReader;
  audit: AuditSink;
  embedder: Embedder;
  newId: () => string;
  now: () => Date;
}
