"use server";

import { revalidatePath } from "next/cache";
import { accessRequestInputSchema, requestAccess } from "@cortex/access";
import type { ActionResult } from "@/lib/action-result";
import { failure } from "@/lib/action-result";
import { getAccessDeps } from "@/lib/access-deps";
import { requireCaller } from "@/lib/auth/caller";
import { formObject } from "@/lib/auth/schemas";

export async function requestAccessAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const caller = await requireCaller("/sectors");
  const raw = formObject(form);
  const input = accessRequestInputSchema.safeParse({ ...raw, message: raw.message === "" ? undefined : raw.message });
  if (!input.success) return { ok: false, message: "Check the request and try again." };
  try {
    await requestAccess(caller, input.data, getAccessDeps());
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/sectors");
  return { ok: true };
}
