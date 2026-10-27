"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { roleChangeSchema, setOrgAdmin, setRole } from "@cortex/access";
import type { ActionResult } from "@/lib/action-result";
import { failure } from "@/lib/action-result";
import { getAccessDeps } from "@/lib/access-deps";
import { requireCaller, requireOrgAdmin } from "@/lib/auth/caller";

export async function setRoleAction(input: unknown): Promise<ActionResult> {
  const caller = await requireCaller("/admin/access");
  const change = roleChangeSchema.safeParse(input);
  if (!change.success) return { ok: false, message: "Check the role and try again." };
  try {
    await setRole(caller, change.data, getAccessDeps());
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/access");
  return { ok: true };
}

const orgAdminSchema = z.object({ userId: z.string().min(1).max(36), isAdmin: z.boolean() });

export async function setOrgAdminAction(input: unknown): Promise<ActionResult> {
  const caller = await requireOrgAdmin("/admin/access");
  const change = orgAdminSchema.safeParse(input);
  if (!change.success) return { ok: false, message: "Check the change and try again." };
  try {
    await setOrgAdmin(caller, change.data, getAccessDeps());
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/access");
  return { ok: true };
}
