"use server";

import { redirect } from "next/navigation";
import { ID, Users } from "node-appwrite";
import { withTimeout } from "@cortex/server-kit";
import { formObject, signupInputSchema } from "@/lib/auth/schemas";
import { adminClientForRequest, signInWithPassword } from "@/lib/auth/sign-in";
import type { LoginState } from "../login/actions";

const signupFailedMessage = "Check your details and try again.";

export async function signup(_previous: LoginState, form: FormData): Promise<LoginState> {
  const input = signupInputSchema.safeParse(formObject(form));
  if (!input.success) return { error: signupFailedMessage };
  try {
    const users = new Users(await adminClientForRequest());
    await withTimeout("users.create", () =>
      users.create({ userId: ID.unique(), email: input.data.email, password: input.data.password, name: input.data.name }),
    10_000);
  } catch (error) {
    console.error("sign-up failed", error instanceof Error ? error.name : "unknown");
    return { error: signupFailedMessage };
  }
  const result = await signInWithPassword(input.data.email, input.data.password);
  if (!result.ok) return { error: result.message };
  redirect("/");
}
