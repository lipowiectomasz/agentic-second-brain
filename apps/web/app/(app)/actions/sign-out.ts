"use server";

import { redirect } from "next/navigation";
import { Account, AppwriteException } from "node-appwrite";
import { withTimeout } from "@cortex/server-kit";
import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { getSessionClient } from "@/lib/auth/session-client";

export async function signOut(): Promise<never> {
  try {
    const client = await getSessionClient();
    await withTimeout("account.deleteSession", () => new Account(client).deleteSession({ sessionId: "current" }));
  } catch (error) {
    if (!(error instanceof AppwriteException && error.code === 401) && !(error instanceof Error && error.name === "UnauthenticatedError")) {
      console.error("sign-out failed", error instanceof Error ? error.name : "unknown");
    }
  }
  await clearSessionCookie();
  redirect("/login");
}
