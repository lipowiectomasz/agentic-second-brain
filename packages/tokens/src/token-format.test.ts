import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateToken, hashToken, parseToken, verifySecret } from "./token-format";

describe("token format", () => {
  it("generates a 56 character token with a base32 prefix", () => {
    const token = generateToken(randomBytes);
    expect(token.value).toHaveLength(56);
    expect(token.value).toMatch(/^cbt_[a-z2-7]{8}_[A-Za-z0-9_-]{43}$/);
    expect(token.value.slice(4, 12)).toBe(token.prefix);
    expect(token.hash).toBe(hashToken(token.value));
  });

  it("gives distinct values for distinct random input", () => {
    expect(generateToken(randomBytes).value).not.toBe(generateToken(randomBytes).value);
  });

  it("parses only well formed tokens", () => {
    const token = generateToken(randomBytes).value;
    expect(parseToken(token)).toEqual({ prefix: token.slice(4, 12) });
    expect(parseToken(token.slice(0, 55))).toBeNull();
    expect(parseToken(`cbt_${token.slice(4, 12).toUpperCase()}${token.slice(12)}`)).toBeNull();
    expect(parseToken(`xyz_${token.slice(4)}`)).toBeNull();
  });

  it("verifies the secret against the stored hash", () => {
    const token = generateToken(randomBytes);
    const tampered = `${token.value.slice(0, 55)}${token.value.endsWith("A") ? "B" : "A"}`;
    expect(verifySecret(token.value, token.hash)).toBe(true);
    expect(verifySecret(tampered, token.hash)).toBe(false);
    expect(verifySecret(token.value, "abc")).toBe(false);
  });
});
