import { describe, expect, it } from "vitest";
import { createTablesAuditSink } from "./sink";

const event = { actorId: "u1", actorName: "Ada", channel: "web" as const, action: "sector.created" as const, sectorId: "atlas", target: "sector:atlas" };

function fakeTables(failures: number) {
  const calls: Array<{ data: Record<string, unknown>; permissions?: string[] }> = [];
  let remaining = failures;
  return {
    calls,
    tables: {
      async createRow(input: { data: Record<string, unknown>; permissions?: string[] }) {
        calls.push(input);
        if (remaining > 0) {
          remaining -= 1;
          throw new Error("offline");
        }
        return {} as never;
      },
    } as never,
  };
}

describe("createTablesAuditSink", () => {
  it("writes an admin-only row", async () => {
    const fake = fakeTables(0);
    await createTablesAuditSink(fake.tables, { tables: "t" }, { retryDelayMs: 0 }).record(event);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.permissions).toEqual(['read("label:admin")']);
    expect(fake.calls[0]?.data).toMatchObject({ action: "sector.created", target: "sector:atlas", detail: null });
  });

  it("retries once and never throws into the caller", async () => {
    const once = fakeTables(1);
    await createTablesAuditSink(once.tables, { tables: "t" }, { retryDelayMs: 0 }).record(event);
    expect(once.calls).toHaveLength(2);
    const logs: string[] = [];
    const twice = fakeTables(2);
    await expect(createTablesAuditSink(twice.tables, { tables: "t" }, { retryDelayMs: 0, log: (line) => logs.push(line) }).record(event)).resolves.toBeUndefined();
    expect(logs).toEqual(["audit write failed: sector.created sector:atlas"]);
  });
});
