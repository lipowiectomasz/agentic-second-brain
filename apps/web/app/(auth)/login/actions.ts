"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { formObject, loginInputSchema } from "@/lib/auth/schemas";
import { invalidCredentialsMessage, signInWithPassword } from "@/lib/auth/sign-in";

export interface LoginState {
  error: string | null;
}

export async function loginWithPassword(_previous: LoginState, form: FormData): Promise<LoginState> {
  const input = loginInputSchema.safeParse(formObject(form));
  if (!input.success) return { error: invalidCredentialsMessage };
  const result = await signInWithPassword(input.data.email, input.data.password);
  if (!result.ok) return { error: result.message };
  redirect(safeNextPath(input.data.next));
}
