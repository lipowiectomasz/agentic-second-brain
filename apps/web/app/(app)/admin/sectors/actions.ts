"use server";

import { revalidatePath } from "next/cache";
import { createSector, sectorInputSchema } from "@cortex/access";
import type { ActionResult } from "@/lib/action-result";
import { failure } from "@/lib/action-result";
import { getAccessDeps } from "@/lib/access-deps";
import { requireOrgAdmin } from "@/lib/auth/caller";
import { formObject } from "@/lib/auth/schemas";

export async function createSectorAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const caller = await requireOrgAdmin("/admin/sectors");
  const raw = formObject(form);
  const input = sectorInputSchema.safeParse({ ...raw, description: raw.description === "" ? undefined : raw.description });
  if (!input.success) return { ok: false, message: "Check the name, slug and colour." };
  try {
    await createSector(caller, input.data, getAccessDeps());
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/sectors");
  return { ok: true };
}
