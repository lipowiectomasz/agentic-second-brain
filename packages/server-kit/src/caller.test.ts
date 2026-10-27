import { describe, expect, it } from "vitest";
import { isOrgAdmin, toCaller } from "./caller";

const user = { $id: "u1", name: "Ada", email: "ada@example.com", labels: ["admin"] };

describe("toCaller", () => {
  it("maps id, name, email, labels and channel", () => {
    expect(toCaller(user, "web")).toEqual({ userId: "u1", name: "Ada", email: "ada@example.com", labels: ["admin"], channel: "web" });
  });

  it("keeps the token scope for tool callers", () => {
    expect(toCaller(user, "token", "read").tokenScope).toBe("read");
  });
});

describe("isOrgAdmin", () => {
  it("is true only with the admin label", () => {
    expect(isOrgAdmin({ labels: ["admin"] })).toBe(true);
    expect(isOrgAdmin({ labels: ["admins", "maintainer"] })).toBe(false);
    expect(isOrgAdmin({ labels: [] })).toBe(false);
  });
});
