"use server";

import { revalidatePath } from "next/cache";
import { createTokenInputSchema } from "@cortex/gateway-contract";
import { TokenLimitReachedError, TokenNotFoundError } from "@cortex/tokens";
import type { ActionResult } from "@/lib/action-result";
import { requireCaller } from "@/lib/auth/caller";
import { formObject } from "@/lib/auth/schemas";
import { getTokenService } from "@/lib/tokens/service";

export type CreateTokenState =
  | { status: "idle" }
  | { status: "created"; value: string; name: string; scope: "read" | "write"; expiresAt: string }
  | { status: "error"; message: string; field?: "name" };

export async function createTokenAction(_previous: CreateTokenState, form: FormData): Promise<CreateTokenState> {
  const caller = await requireCaller("/settings/tokens");
  const input = createTokenInputSchema.safeParse(formObject(form));
  if (!input.success) {
    const nameIssue = input.error.issues.some((issue) => issue.path[0] === "name");
    return nameIssue ? { status: "error", message: "Give the token a name of 1 to 64 characters.", field: "name" } : { status: "error", message: "Choose an access level and an expiry." };
  }
  try {
    const created = await getTokenService().create(caller, input.data);
    revalidatePath("/settings/tokens");
    return { status: "created", value: created.value, name: created.record.name, scope: created.record.scope, expiresAt: created.record.expiresAt };
  } catch (error) {
    if (error instanceof TokenLimitReachedError) return { status: "error", message: `You already have ${error.limit} active tokens. Revoke one to create another.` };
    console.error("token creation failed", error instanceof Error ? error.name : "unknown");
    return { status: "error", message: "Something went wrong. Try again." };
  }
}

export async function revokeTokenAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const caller = await requireCaller("/settings/tokens");
  const tokenId = form.get("tokenId");
  if (typeof tokenId !== "string" || !/^[a-zA-Z0-9._-]{1,36}$/.test(tokenId)) return { ok: false, message: "This token no longer exists." };
  try {
    await getTokenService().revoke(caller, tokenId);
  } catch (error) {
    if (error instanceof TokenNotFoundError) return { ok: false, message: "This token no longer exists." };
    console.error("token revocation failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, message: "Something went wrong. Try again." };
  }
  revalidatePath("/settings/tokens");
  revalidatePath("/admin/tokens");
  return { ok: true };
}
