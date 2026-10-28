"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptProposal, rejectProposal } from "@cortex/proposals";
import type { ActionResult } from "@/lib/action-result";
import { requireOrgAdmin } from "@/lib/auth/caller";
import { proposalMessage } from "@/lib/proposal-messages";
import { proposalDeps } from "@/lib/proposals";

export async function acceptProposalAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const caller = await requireOrgAdmin("/admin/proposals");
  const id = form.get("proposalId");
  if (typeof id !== "string") return { ok: false, message: "This proposal no longer exists." };
  let result;
  try {
    result = await acceptProposal(caller, id, proposalDeps());
  } catch (error) {
    return { ok: false, message: proposalMessage(error).message };
  }
  revalidatePath("/admin/proposals");
  redirect(`/admin/proposals/${id}?result=${result.outcome}${result.overwrittenVersion === null ? "" : `&kept=${result.overwrittenVersion}`}`);
}

export async function rejectProposalAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const caller = await requireOrgAdmin("/admin/proposals");
  const id = form.get("proposalId");
  const note = form.get("note");
  if (typeof id !== "string" || typeof note !== "string" || note.trim() === "") return { ok: false, message: "Tell the author why." };
  try {
    await rejectProposal(caller, { proposalId: id, note }, proposalDeps());
  } catch (error) {
    return { ok: false, message: proposalMessage(error).message };
  }
  revalidatePath("/admin/proposals");
  redirect(`/admin/proposals/${id}`);
}
