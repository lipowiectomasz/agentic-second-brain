import "server-only";
import { TablesDB } from "node-appwrite";
import type { SectorView } from "@cortex/access";
import { listMySectors as listMySectorsForCaller } from "@cortex/access";
import type { Caller } from "@cortex/server-kit";
import { getAccessDeps } from "@/lib/access-deps";
import { getSessionClient } from "@/lib/auth/session-client";

export async function listMySectors(caller: Caller): Promise<SectorView[]> {
  return listMySectorsForCaller(caller, new TablesDB(await getSessionClient()), getAccessDeps());
}
