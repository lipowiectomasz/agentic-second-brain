import type { Client, Models } from "node-appwrite";
import { Account } from "node-appwrite";
import { z } from "zod";
import { adminLabel } from "@cortex/core";
import { mapAppwriteAuthError } from "./errors";
import { withTimeout } from "./timeout";

export const callerSchema = z.object({
  userId: z.string().min(1).max(36),
  name: z.string(),
  email: z.string(),
  labels: z.array(z.string()),
  channel: z.enum(["web", "token"]),
  tokenScope: z.enum(["read", "write"]).optional(),
});

export type Caller = z.infer<typeof callerSchema>;

export const ORG_ADMIN_LABEL = adminLabel;

export function toCaller(
  user: Pick<Models.User<Models.Preferences>, "$id" | "name" | "email" | "labels">,
  channel: Caller["channel"],
  tokenScope?: Caller["tokenScope"],
): Caller {
  return callerSchema.parse({
    userId: user.$id,
    name: user.name,
    email: user.email,
    labels: user.labels,
    channel,
    ...(tokenScope === undefined ? {} : { tokenScope }),
  });
}

export async function resolveCaller(client: Client, channel: Caller["channel"], tokenScope?: Caller["tokenScope"]): Promise<Caller> {
  try {
    const user = await withTimeout("account.get", () => new Account(client).get(), 10_000);
    return toCaller(user, channel, tokenScope);
  } catch (error) {
    throw mapAppwriteAuthError(error);
  }
}

export function isOrgAdmin(caller: Pick<Caller, "labels">): boolean {
  return caller.labels.includes(ORG_ADMIN_LABEL);
}
