import { TablesDB } from "node-appwrite";
import { noopAuditSink } from "@cortex/audit";
import { routes } from "@cortex/gateway-contract";
import { ProposalError, submitProposal } from "@cortex/proposals";
import type { GatewayContext } from "../context";
import { GatewayError } from "../map-error";
import { route } from "../router";
import { writeDeps } from "./deps";

const maxPending = Number.parseInt(process.env.CORTEX_MAX_PENDING_PROPOSALS ?? "20", 10) || 20;

const messages: Record<string, [ "bad_request" | "secret_detected" | "payload_too_large" | "forbidden", string]> = {
  invalid_input: ["bad_request", "The proposal is incomplete."],
  invalid_target: ["bad_request", "The target must be standards/... for a standard or procedures/... for a procedure, ending with .md."],
  secret_detected: ["secret_detected", "The proposal looks like it contains a secret."],
  too_large: ["payload_too_large", "The proposal is larger than 256 KiB."],
  too_many_pending: ["forbidden", "You have reached the limit of pending proposals."],
};

export async function proposalsSubmit(ctx: GatewayContext, input: Parameters<typeof submitProposal>[1]): Promise<{ proposalId: string }> {
  try {
    return await submitProposal(ctx.caller, input, { tables: new TablesDB(ctx.adminClient), databaseId: ctx.ids.tables, audit: noopAuditSink, knowledge: writeDeps(ctx), maxPending, now: () => new Date() });
  } catch (error) {
    if (error instanceof ProposalError && messages[error.code] !== undefined) {
      const [code, message] = messages[error.code] as [ "bad_request" | "secret_detected" | "payload_too_large" | "forbidden", string];
      throw new GatewayError(code, error.detail === null ? message : `${message} (${error.detail})`);
    }
    throw error;
  }
}

export const proposalsSubmitRoute = route(routes.proposalsSubmit, proposalsSubmit);
