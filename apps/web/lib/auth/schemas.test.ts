import { describe, expect, it } from "vitest";
import { loginInputSchema, signupInputSchema } from "./schemas";

describe("auth input schemas", () => {
  it("accepts a valid login", () => {
    expect(loginInputSchema.safeParse({ email: "ada@example.com", password: "x" }).success).toBe(true);
  });

  it("rejects an invalid e-mail and an empty password", () => {
    expect(loginInputSchema.safeParse({ email: "ada", password: "x" }).success).toBe(false);
    expect(loginInputSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
  });

  it("requires a 12-character password and a trimmed name on sign-up", () => {
    expect(signupInputSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "short" }).success).toBe(false);
    expect(signupInputSchema.safeParse({ name: "   ", email: "ada@example.com", password: "long-enough-pass" }).success).toBe(false);
    expect(signupInputSchema.parse({ name: " Ada ", email: "ada@example.com", password: "long-enough-pass" }).name).toBe("Ada");
  });
});
