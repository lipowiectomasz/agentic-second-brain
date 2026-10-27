import { describe, expect, it } from "vitest";
import { relatedInputSchema, searchInputSchema } from "./search-types";

describe("searchInputSchema", () => {
  it("trims the query and applies defaults", () => {
    expect(searchInputSchema.parse({ query: "  rollback  " })).toEqual({ query: "rollback", limit: 10, includeSuperseded: false });
  });

  it.each([{ query: "   " }, { query: "x".repeat(501) }, { query: "q", limit: 21 }, { query: "q", sectorIds: ["Bad Id"] }, { query: "q", kinds: ["image"] }])("rejects %o", (input) => {
    expect(searchInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("relatedInputSchema", () => {
  it("defaults to five results without superseded documents", () => {
    expect(relatedInputSchema.parse({ fileId: "f1" })).toEqual({ fileId: "f1", limit: 5, includeSuperseded: false });
  });
});
