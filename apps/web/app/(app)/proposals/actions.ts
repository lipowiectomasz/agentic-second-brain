"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { submitProposal, withdrawProposal } from "@cortex/proposals";
import type { ActionResult } from "@/lib/action-result";
import { requireCaller } from "@/lib/auth/caller";
import { formObject } from "@/lib/auth/schemas";
import { proposalMessage } from "@/lib/proposal-messages";
import { proposalDeps } from "@/lib/proposals";

export type ProposalFormState = { status: "idle" } | { status: "error"; message: string; field?: "targetPath" | "content" | "title" | "rationale" };

export async function submitProposalAction(_previous: ProposalFormState, form: FormData): Promise<ProposalFormState> {
  const caller = await requireCaller("/proposals/new");
  const raw = formObject(form);
  const baseVersion = raw.baseVersion === undefined || raw.baseVersion === "" ? null : Number.parseInt(raw.baseVersion, 10);
  const source = raw.sourceSectorId !== undefined && raw.sourceSectorId !== "" && raw.sourcePath !== undefined ? { sectorId: raw.sourceSectorId, path: raw.sourcePath } : null;
  try {
    await submitProposal(caller, { kind: raw.kind === "procedure" ? "procedure" : "standard", targetPath: raw.targetPath ?? "", baseVersion: Number.isFinite(baseVersion) ? baseVersion : null, title: raw.title ?? "", rationale: raw.rationale ?? "", content: raw.content ?? "", source }, proposalDeps());
  } catch (error) {
    return { status: "error", ...proposalMessage(error) };
  }
  revalidatePath("/proposals");
  redirect("/proposals?submitted=1");
}

export async function withdrawProposalAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const caller = await requireCaller("/proposals");
  const id = form.get("proposalId");
  if (typeof id !== "string") return { ok: false, message: "This proposal no longer exists." };
  try {
    await withdrawProposal(caller, id, proposalDeps());
  } catch (error) {
    return { ok: false, message: proposalMessage(error).message };
  }
  revalidatePath("/proposals");
  return { ok: true };
}
