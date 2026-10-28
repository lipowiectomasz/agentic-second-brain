import { describe, expect, it } from "vitest";
import { toCaller } from "@cortex/server-kit";
import { canDecide, canWithdraw } from "./rules";
import { proposalStatuses } from "./types";

const admin = toCaller({ $id: "a", name: "A", email: "a@example.com", labels: ["admin"] }, "web");
const member = toCaller({ $id: "m", name: "M", email: "m@example.com", labels: [] }, "web");

describe("proposal rules", () => {
  it("lets only admins decide, and only pending proposals", () => {
    for (const status of proposalStatuses) {
      expect(canDecide(admin, { status })).toEqual(status === "pending" ? { ok: true } : { ok: false, reason: "already_decided" });
      expect(canDecide(member, { status })).toEqual({ ok: false, reason: "not_admin" });
    }
  });

  it("lets only the proposer withdraw a pending proposal", () => {
    expect(canWithdraw(member, { proposerId: "m", status: "pending" })).toEqual({ ok: true });
    expect(canWithdraw(member, { proposerId: "m", status: "accepted" })).toEqual({ ok: false, reason: "already_decided" });
    expect(canWithdraw(admin, { proposerId: "m", status: "pending" })).toEqual({ ok: false, reason: "not_proposer" });
  });
});
