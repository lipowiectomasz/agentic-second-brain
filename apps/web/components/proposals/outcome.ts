import type { ProposalOutcome } from "@cortex/proposals/types";

export function outcomeMessage(outcome: ProposalOutcome | null, kept: number | null): string | null {
  if (outcome === null) return null;
  if (outcome === "merged") return "Accepted and merged with newer changes.";
  if (outcome === "overwritten") return `Accepted. The previous version is kept in history (v${kept ?? "?"}).`;
  if (outcome === "unchanged") return "Accepted. The spine already had this content.";
  return "Accepted and published to the spine.";
}
