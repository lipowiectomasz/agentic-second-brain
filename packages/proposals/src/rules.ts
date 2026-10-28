import type { Caller } from "@cortex/server-kit";
import { isOrgAdmin } from "@cortex/server-kit";
import type { ProposalStatus } from "./types";

export function canDecide(caller: Caller, proposal: { status: ProposalStatus }): { ok: true } | { ok: false; reason: "not_admin" | "already_decided" } {
  if (!isOrgAdmin(caller)) return { ok: false, reason: "not_admin" };
  if (proposal.status !== "pending") return { ok: false, reason: "already_decided" };
  return { ok: true };
}

export function canWithdraw(caller: Caller, proposal: { proposerId: string; status: ProposalStatus }): { ok: true } | { ok: false; reason: "not_proposer" | "already_decided" } {
  if (proposal.proposerId !== caller.userId) return { ok: false, reason: "not_proposer" };
  if (proposal.status !== "pending") return { ok: false, reason: "already_decided" };
  return { ok: true };
}
