import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Caller } from "@cortex/server-kit";
import { ForbiddenError, UnauthenticatedError, createSessionClient, isOrgAdmin, resolveCaller } from "@cortex/server-kit";
import { serverEnv } from "@/lib/env";
import { readSessionSecret } from "./session-cookie";

export type CallerLookup = { status: "signed-in"; caller: Caller } | { status: "anonymous" } | { status: "expired" };

export const lookupCaller = cache(async (): Promise<CallerLookup> => {
  const secret = await readSessionSecret();
  if (secret === null) return { status: "anonymous" };
  try {
    return { status: "signed-in", caller: await resolveCaller(createSessionClient(serverEnv(), secret), "web") };
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { status: "expired" };
    throw error;
  }
});

export async function getCaller(): Promise<Caller | null> {
  const lookup = await lookupCaller();
  return lookup.status === "signed-in" ? lookup.caller : null;
}

export async function requireCaller(nextPath: string): Promise<Caller> {
  const lookup = await lookupCaller();
  if (lookup.status === "expired") redirect(`/auth/expired?next=${encodeURIComponent(nextPath)}`);
  if (lookup.status === "anonymous") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return lookup.caller;
}

export async function requireOrgAdmin(nextPath: string): Promise<Caller> {
  const caller = await requireCaller(nextPath);
  if (!isOrgAdmin(caller)) throw new ForbiddenError("organisation admin required");
  return caller;
}
