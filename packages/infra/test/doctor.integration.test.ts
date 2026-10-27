import { describe, expect, it } from "vitest";
import { runDoctor } from "../src/commands/doctor";

describe("platform doctor", () => {
  it("generates a 768-dimension embedding and runs the health function", async () => {
    const report = await runDoctor();
    expect(report.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(report.embeddingDimension).toBe(768);
    expect(report.healthStatus).toBe(200);
  });
});
