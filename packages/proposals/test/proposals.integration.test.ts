import { randomBytes } from "node:crypto";
import { Account, ID, TablesDB, Teams, Users } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSectorRole } from "@cortex/access";
import { MemoryAuditSink } from "@cortex/audit";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { KnowledgeStore, createAppwriteEmbedder, ingestFile } from "@cortex/knowledge";
import type { Caller } from "@cortex/server-kit";
import { createAdminClient, createSessionClient, toCaller } from "@cortex/server-kit";
import type { ProposalDeps } from "../src";
import { acceptProposal, getProposal, getReviewModel, listForReview, listMine, rejectProposal, submitProposal, withdrawProposal } from "../src";

const env = loadServerEnv(process.env);
const admin = createAdminClient(env);
const ids = databaseIds(env.CORTEX_TEST_DATABASE_NAMESPACE);
const tables = new TablesDB(admin);
const users = new Users(admin);
const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const audit = new MemoryAuditSink();
const accessDeps = { admin: { tables, teams: new Teams(admin), users }, ids: { tables: ids.tables }, audit, includeTestIdentities: true };
const knowledge = { admin, ids, access: { getSectorRole: (caller: Caller, sectorId: string) => getSectorRole(caller, sectorId, accessDeps) }, audit, embedder: createAppwriteEmbedder(admin), newId: () => ID.unique(), now: () => new Date() };
const deps: ProposalDeps = { tables, databaseId: ids.tables, audit, knowledge, maxPending: 20, now: () => new Date() };
const created: string[] = [];
const people: Record<"member" | "other" | "boss", { caller: Caller; tables: TablesDB }> = {} as never;

async function person(name: "member" | "other" | "boss", labels: string[]) {
  const email = `test-${name}-p-${stamp}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const user = await users.create({ userId: ID.unique(), email, password, name: `test-${name}-${stamp}` });
  created.push(user.$id);
  if (labels.length > 0) await users.updateLabels({ userId: user.$id, labels });
  const session = await new Account(admin).createEmailPasswordSession({ email, password });
  return { caller: toCaller({ ...user, labels }, "web"), tables: new TablesDB(createSessionClient(env, session.secret)) };
}

const path = (name: string) => `standards/test-${stamp}-${name}.md`;
const base = { kind: "standard" as const, baseVersion: null, rationale: "Teams keep asking how to do this.", source: null };

beforeAll(async () => {
  people.member = await person("member", []);
  people.other = await person("other", []);
  people.boss = await person("boss", ["admin"]);
});

afterAll(async () => {
  for (const userId of created) await users.delete({ userId }).catch(() => undefined);
});

describe("spine proposals", () => {
  it("publishes an accepted new standard and lets only the proposer and admins read it", async () => {
    const { proposalId } = await submitProposal(people.member.caller, { ...base, title: "Release checklist", targetPath: path("release"), content: "# Release checklist\n\nTag, build, deploy.\n" }, deps);
    expect((await listMine(people.member.caller, people.member.tables, ids.tables)).some((item) => item.id === proposalId)).toBe(true);
    await expect(getProposal(people.other.tables, ids.tables, proposalId)).rejects.toMatchObject({ code: "not_found" });
    await expect(acceptProposal(people.other.caller, proposalId, deps)).rejects.toThrow("Forbidden");
    const queue = await listForReview(people.boss.caller, people.boss.tables, ids.tables);
    expect(queue.items.some((item) => item.id === proposalId)).toBe(true);
    expect(queue.pending).toBeGreaterThan(0);
    const review = await getReviewModel(people.boss.caller, proposalId, deps);
    expect(review.againstBase.every((row) => row.kind === "add")).toBe(true);
    const accepted = await acceptProposal(people.boss.caller, proposalId, deps);
    expect(accepted.outcome).toBe("created");
    const file = await new KnowledgeStore(admin, ids).fileByPath("spine", path("release"));
    expect(file?.content).toContain("Tag, build, deploy.");
    await expect(acceptProposal(people.boss.caller, proposalId, deps)).rejects.toMatchObject({ code: "already_decided" });
    expect(await getProposal(people.member.tables, ids.tables, proposalId)).toMatchObject({ status: "accepted", resultOutcome: "created", resultFileId: accepted.fileId });
    expect(audit.events.filter((event) => event.target.includes(proposalId)).map((event) => event.action)).toEqual(["proposal.submitted", "proposal.accepted"]);
  });

  it("merges a change with newer edits of the target and keeps history on overlap", async () => {
    const target = path("branching");
    await ingestFile(knowledge, people.boss.caller, { sectorId: "spine", path: target, content: "# Branching\n\nUse git flow.\n\n## Merging\n\nMerge commits.\n", baseVersion: null, baseHash: null });
    const disjoint = await submitProposal(people.member.caller, { ...base, title: "Branching", targetPath: target, baseVersion: 1, content: "# Branching\n\nUse short-lived branches.\n\n## Merging\n\nMerge commits.\n" }, deps);
    await ingestFile(knowledge, people.boss.caller, { sectorId: "spine", path: target, content: "# Branching\n\nUse git flow.\n\n## Merging\n\nSquash after review.\n", baseVersion: 1, baseHash: null });
    const review = await getReviewModel(people.boss.caller, disjoint.proposalId, deps);
    expect(review.currentVersion).toBe(2);
    expect(review.againstCurrent).not.toBeNull();
    const merged = await acceptProposal(people.boss.caller, disjoint.proposalId, deps);
    expect(merged.outcome).toBe("merged");
    const file = await new KnowledgeStore(admin, ids).fileByPath("spine", target);
    expect(file?.content).toContain("short-lived branches");
    expect(file?.content).toContain("Squash after review.");

    const overlapping = await submitProposal(people.other.caller, { ...base, title: "Branching", targetPath: target, baseVersion: 2, content: "# Branching\n\nUse trunk-based development.\n\n## Merging\n\nRebase only.\n" }, deps);
    const result = await acceptProposal(people.boss.caller, overlapping.proposalId, deps);
    expect(result.outcome).toBe("overwritten");
    expect(result.overwrittenVersion).not.toBeNull();
  });

  it("refuses secrets, bad targets and rejections without a note, and supports withdrawal", async () => {
    await expect(submitProposal(people.member.caller, { ...base, title: "Env", targetPath: path("env"), content: `# Env\n\nDATABASE_PASSWORD=${randomBytes(24).toString("base64url")}\n` }, deps)).rejects.toMatchObject({ code: "secret_detected" });
    await expect(submitProposal(people.member.caller, { ...base, title: "Wrong", targetPath: "procedures/x.md", content: "# X\n" }, deps)).rejects.toMatchObject({ code: "invalid_target" });
    const { proposalId } = await submitProposal(people.member.caller, { ...base, title: "Postmortems", targetPath: path("postmortem"), content: "# Postmortems\n" }, deps);
    await expect(rejectProposal(people.boss.caller, { proposalId, note: "  " }, deps)).rejects.toMatchObject({ code: "invalid_input" });
    await rejectProposal(people.boss.caller, { proposalId, note: "Already covered by the incident runbook." }, deps);
    expect(await getProposal(people.member.tables, ids.tables, proposalId)).toMatchObject({ status: "rejected", decisionNote: "Already covered by the incident runbook." });
    const second = await submitProposal(people.member.caller, { ...base, title: "Naming", targetPath: path("naming"), content: "# Naming\n" }, deps);
    await expect(withdrawProposal(people.other.caller, second.proposalId, deps)).rejects.toMatchObject({ code: "not_found" });
    await withdrawProposal(people.member.caller, second.proposalId, deps);
    expect(await getProposal(people.member.tables, ids.tables, second.proposalId)).toMatchObject({ status: "withdrawn" });
  });
});
