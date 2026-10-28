import { ProposalError } from "@cortex/proposals";
import { ForbiddenError } from "@cortex/server-kit";

export function proposalMessage(error: unknown): { message: string; field?: "targetPath" | "content" | "title" | "rationale" } {
  if (error instanceof ProposalError) {
    switch (error.code) {
      case "invalid_target":
        return { message: "Target path must start with standards/ for a standard or procedures/ for a procedure, use lowercase letters, and end with .md.", field: "targetPath" };
      case "secret_detected": {
        const line = /:(\d+)/.exec(error.detail ?? "")?.[1];
        return { message: `This content looks like it contains a secret${line === undefined ? "" : ` (line ${line})`}. Remove it and try again.`, field: "content" };
      }
      case "too_large":
        return { message: "Content exceeds 256 KB.", field: "content" };
      case "too_many_pending":
        return { message: "You have reached the limit of pending proposals." };
      case "already_decided":
        return { message: "This proposal has already been decided." };
      case "not_found":
        return { message: "This proposal no longer exists." };
      case "invalid_input":
        return { message: "Fill in every field: title, kind, target path, content and rationale." };
      default:
        return { message: "Something went wrong. Try again." };
    }
  }
  if (error instanceof ForbiddenError) return { message: "Only organisation admins can decide proposals." };
  console.error("proposal action failed", error instanceof Error ? error.name : "unknown");
  return { message: "Something went wrong. Try again." };
}
