export type ProposalErrorCode = "invalid_input" | "invalid_target" | "secret_detected" | "too_large" | "too_many_pending" | "not_found" | "not_admin" | "not_proposer" | "already_decided";

export class ProposalError extends Error {
  constructor(
    readonly code: ProposalErrorCode,
    readonly detail: string | null = null,
  ) {
    super(`Proposal failed: ${code}`);
    this.name = "ProposalError";
  }
}
