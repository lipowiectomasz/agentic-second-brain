import { createHash, timingSafeEqual } from "node:crypto";
import { tokenPattern } from "@cortex/gateway-contract";

export interface GeneratedToken {
  value: string;
  prefix: string;
  hash: string;
}

const base32 = "abcdefghijklmnopqrstuvwxyz234567";

function encodePrefix(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += base32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return output.slice(0, 8);
}

export function generateToken(random: (size: number) => Buffer): GeneratedToken {
  const prefix = encodePrefix(random(5));
  const value = `cbt_${prefix}_${random(32).toString("base64url")}`;
  return { value, prefix, hash: hashToken(value) };
}

export function parseToken(value: string): { prefix: string } | null {
  if (value.length !== 56 || !tokenPattern.test(value)) return null;
  return { prefix: value.slice(4, 12) };
}

export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function verifySecret(value: string, storedHash: string): boolean {
  const actual = Buffer.from(hashToken(value), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
