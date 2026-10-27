import "server-only";
import type { SectorRole } from "@cortex/core";

export interface MySector {
  id: string;
  name: string;
  role: SectorRole;
}

export async function listMySectors(): Promise<MySector[]> {
  return [];
}
