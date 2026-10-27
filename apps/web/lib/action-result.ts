import "server-only";
import {
  AlreadyMemberError,
  ForbiddenError,
  LastAdminError,
  RequestAlreadyDecidedError,
  RequestPendingError,
  SectorNotFoundError,
  SlugTakenError,
  UserNotFoundError,
} from "@cortex/access";

export type ActionResult = { ok: true } | { ok: false; message: string };

const forbiddenMessages: Record<string, string> = {
  maintainer_requires_admin: "Only organisation admins can manage maintainers.",
  spine_read_only: "Roles in the spine cannot be changed.",
};

export function failure(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) return { ok: false, message: forbiddenMessages[error.reason] ?? "You cannot change roles in this sector." };
  if (error instanceof SlugTakenError) return { ok: false, message: "This slug is already taken." };
  if (error instanceof RequestAlreadyDecidedError) return { ok: false, message: "This request has already been decided." };
  if (error instanceof AlreadyMemberError) return { ok: false, message: "You already have access to this sector." };
  if (error instanceof RequestPendingError) return { ok: false, message: "Your request is already pending." };
  if (error instanceof LastAdminError) return { ok: false, message: "At least one organisation admin must remain." };
  if (error instanceof SectorNotFoundError || error instanceof UserNotFoundError) return { ok: false, message: "This item no longer exists." };
  console.error("action failed", error instanceof Error ? error.name : "unknown");
  return { ok: false, message: "Something went wrong. Try again." };
}
