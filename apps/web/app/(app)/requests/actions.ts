"use server";

import { revalidatePath } from "next/cache";
import { decideRequest, requestDecisionSchema } from "@cortex/access";
import type { ActionResult } from "@/lib/action-result";
import { failure } from "@/lib/action-result";
import { getAccessDeps } from "@/lib/access-deps";
import { requireCaller } from "@/lib/auth/caller";
import { formObject } from "@/lib/auth/schemas";

export async function decideRequestAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const caller = await requireCaller("/requests");
  const input = requestDecisionSchema.safeParse(formObject(form));
  if (!input.success) return { ok: false, message: "Check the request and try again." };
  try {
    await decideRequest(caller, input.data, getAccessDeps());
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/requests");
  return { ok: true };
}
