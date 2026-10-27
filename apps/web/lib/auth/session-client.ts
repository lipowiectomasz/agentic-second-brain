import "server-only";
import type { Client } from "node-appwrite";
import { UnauthenticatedError, createSessionClient } from "@cortex/server-kit";
import { serverEnv } from "@/lib/env";
import { readSessionSecret } from "./session-cookie";

export async function getSessionClient(): Promise<Client> {
  const secret = await readSessionSecret();
  if (secret === null) throw new UnauthenticatedError();
  return createSessionClient(serverEnv(), secret);
}
