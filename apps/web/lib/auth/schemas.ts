import { z } from "zod";

const email = z.email().max(254);

export const loginInputSchema = z.object({
  email,
  password: z.string().min(1).max(256),
  next: z.string().max(2048).optional(),
});

export const signupInputSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email,
  password: z.string().min(12).max(256),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type SignupInput = z.infer<typeof signupInputSchema>;

export function formObject(form: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}
