import type { Models, TablesDB } from "node-appwrite";
import { AppwriteException, ID, Permission, Query, Role } from "node-appwrite";
import type { AuditSink } from "@cortex/audit";
import { adminLabel } from "@cortex/core";
import { stripManagedFrontmatter } from "@cortex/core/body-hash";
import { scanForSecrets } from "@cortex/core/secrets";
import type { KnowledgeWriteDeps } from "@cortex/knowledge";
import { KnowledgeStore, applySpineChange } from "@cortex/knowledge";
import type { Caller } from "@cortex/server-kit";
import { ForbiddenError, isOrgAdmin, withTimeout } from "@cortex/server-kit";
import { buildDiffModel } from "./diff";
import { ProposalError } from "./errors";
import { canDecide, canWithdraw } from "./rules";
import { validateTarget } from "./target";
import type { DiffRow, ProposalDetail, ProposalOutcome, ProposalStatus, ProposalSummary, SubmitProposalInput } from "./types";
import { maxContentBytes, rejectProposalSchema, submitProposalSchema } from "./types";

export const proposalsTableId = "proposals";
export const spineSectorId = "spine";

export interface ProposalDeps {
  tables: TablesDB;
  databaseId: string;
  audit: AuditSink;
  knowledge: KnowledgeWriteDeps;
  maxPending: number;
  now: () => Date;
}

type ProposalRow = Models.Row & {
  proposerId: string;
  proposerName: string;
  kind: "standard" | "procedure";
  targetPath: string;
  targetFileId: string | null;
  baseVersion: number | null;
  title: string;
  rationale: string;
  content: string;
  sourceSectorId: string | null;
  sourcePath: string | null;
  channel: "web" | "token";
  status: ProposalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  resultFileId: string | null;
  resultOutcome: ProposalOutcome | null;
  overwrittenVersion: number | null;
};

const summaryColumns = ["$id", "$createdAt", "proposerId", "proposerName", "kind", "title", "targetPath", "targetFileId", "sourceSectorId", "sourcePath", "status", "decisionNote", "decidedAt", "decidedBy", "resultFileId", "resultOutcome", "overwrittenVersion"];

function toSummary(row: ProposalRow): ProposalSummary {
  return {
    id: row.$id,
    proposerId: row.proposerId,
    proposerName: row.proposerName,
    kind: row.kind,
    title: row.title,
    targetPath: row.targetPath,
    isChange: row.targetFileId !== null,
    sourceSectorId: row.sourceSectorId,
    sourcePath: row.sourcePath,
    status: row.status === "accepting" ? "pending" : row.status,
    createdAt: row.$createdAt,
    decisionNote: row.decisionNote,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    resultFileId: row.resultFileId,
    resultOutcome: row.resultOutcome,
    overwrittenVersion: row.overwrittenVersion,
  };
}

function toDetail(row: ProposalRow): ProposalDetail {
  return { ...toSummary(row), rationale: row.rationale, content: row.content, baseVersion: row.baseVersion, targetFileId: row.targetFileId };
}

async function audit(deps: ProposalDeps, caller: Caller, action: "proposal.submitted" | "proposal.accepted" | "proposal.rejected" | "proposal.withdrawn", row: { $id: string; targetPath: string }, detail?: string): Promise<void> {
  await deps.audit.record({ actorId: caller.userId, actorName: caller.name, channel: caller.channel, action, sectorId: spineSectorId, target: `proposal:${row.$id} ${row.targetPath}`, ...(detail === undefined ? {} : { detail }) });
}

async function adminRow(deps: ProposalDeps, id: string): Promise<ProposalRow> {
  try {
    return await withTimeout("tablesDB.getRow proposal", () => deps.tables.getRow<ProposalRow>({ databaseId: deps.databaseId, tableId: proposalsTableId, rowId: id }));
  } catch (error) {
    if (error instanceof AppwriteException && (error.code === 404 || error.code === 400)) throw new ProposalError("not_found");
    throw error;
  }
}

async function update(deps: ProposalDeps, id: string, data: Record<string, unknown>): Promise<void> {
  await withTimeout("tablesDB.updateRow proposal", () => deps.tables.updateRow({ databaseId: deps.databaseId, tableId: proposalsTableId, rowId: id, data }));
}

export async function submitProposal(caller: Caller, raw: SubmitProposalInput, deps: ProposalDeps): Promise<{ proposalId: string }> {
  const parsed = submitProposalSchema.safeParse(raw);
  if (!parsed.success) throw new ProposalError("invalid_input", parsed.error.issues.map((issue) => issue.path.join(".")).join(", "));
  const input = parsed.data;
  const target = validateTarget(input);
  if (!target.ok) throw new ProposalError("invalid_target", target.reason);
  const content = stripManagedFrontmatter(input.content);
  if (Buffer.byteLength(content, "utf8") > maxContentBytes) throw new ProposalError("too_large");
  const findings = [...scanForSecrets(input.title), ...scanForSecrets(input.rationale), ...scanForSecrets(content)];
  if (findings.length > 0) throw new ProposalError("secret_detected", findings.map((finding) => `${finding.ruleId}:${finding.line}`).join(", "));
  const pending = await withTimeout("tablesDB.listRows pending proposals", () =>
    deps.tables.listRows({ databaseId: deps.databaseId, tableId: proposalsTableId, queries: [Query.equal("proposerId", [caller.userId]), Query.equal("status", ["pending", "accepting"]), Query.select(["$id"]), Query.limit(1)], total: true }),
  );
  if (pending.total >= deps.maxPending) throw new ProposalError("too_many_pending");
  const existing = await new KnowledgeStore(deps.knowledge.admin, deps.knowledge.ids).fileByPath(spineSectorId, target.path);
  if (existing !== null && existing.kind !== input.kind) throw new ProposalError("invalid_target", "kind_mismatch");
  const baseVersion = existing === null ? null : Math.min(input.baseVersion ?? existing.version, existing.version);
  const row = await withTimeout("tablesDB.createRow proposal", () =>
    deps.tables.createRow<ProposalRow>({
      databaseId: deps.databaseId,
      tableId: proposalsTableId,
      rowId: ID.unique(),
      data: {
        proposerId: caller.userId,
        proposerName: caller.name.slice(0, 128),
        kind: input.kind,
        targetPath: target.path,
        targetFileId: existing?.id ?? null,
        baseVersion,
        title: input.title,
        rationale: input.rationale,
        content,
        sourceSectorId: input.source?.sectorId ?? null,
        sourcePath: input.source?.path ?? null,
        channel: caller.channel,
        status: "pending",
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        resultFileId: null,
        resultOutcome: null,
        overwrittenVersion: null,
      },
      permissions: [Permission.read(Role.user(caller.userId)), Permission.read(Role.label(adminLabel))],
    }),
  );
  await audit(deps, caller, "proposal.submitted", row, existing === null ? "new" : `change of v${baseVersion ?? 1}`);
  return { proposalId: row.$id };
}

export async function listMine(caller: Caller, sessionTables: TablesDB, databaseId: string): Promise<ProposalSummary[]> {
  const list = await withTimeout("tablesDB.listRows my proposals", () =>
    sessionTables.listRows<ProposalRow>({ databaseId, tableId: proposalsTableId, queries: [Query.equal("proposerId", [caller.userId]), Query.orderDesc("$createdAt"), Query.select(summaryColumns), Query.limit(100)] }),
  );
  return list.rows.map(toSummary);
}

export async function listForReview(caller: Caller, sessionTables: TablesDB, databaseId: string, filter: ProposalStatus | "all" = "pending"): Promise<{ items: ProposalSummary[]; pending: number }> {
  if (!isOrgAdmin(caller)) throw new ForbiddenError("not_admin");
  const queries = [Query.orderDesc("$createdAt"), Query.select(summaryColumns), Query.limit(50)];
  if (filter !== "all") queries.push(Query.equal("status", filter === "pending" ? ["pending", "accepting"] : [filter]));
  const [list, pending] = await Promise.all([
    withTimeout("tablesDB.listRows proposals", () => sessionTables.listRows<ProposalRow>({ databaseId, tableId: proposalsTableId, queries })),
    pendingCount(caller, sessionTables, databaseId),
  ]);
  return { items: list.rows.map(toSummary), pending };
}

export async function pendingCount(caller: Caller, sessionTables: TablesDB, databaseId: string): Promise<number> {
  if (!isOrgAdmin(caller)) return 0;
  const list = await withTimeout("tablesDB.listRows pending count", () =>
    sessionTables.listRows({ databaseId, tableId: proposalsTableId, queries: [Query.equal("status", ["pending", "accepting"]), Query.select(["$id"]), Query.limit(1)], total: true }),
  );
  return list.total;
}

export async function getProposal(sessionTables: TablesDB, databaseId: string, id: string): Promise<ProposalDetail> {
  try {
    return toDetail(await withTimeout("tablesDB.getRow proposal", () => sessionTables.getRow<ProposalRow>({ databaseId, tableId: proposalsTableId, rowId: id })));
  } catch (error) {
    if (error instanceof AppwriteException && (error.code === 404 || error.code === 400 || error.code === 401)) throw new ProposalError("not_found");
    throw error;
  }
}

export interface ReviewModel {
  proposal: ProposalDetail;
  againstBase: DiffRow[];
  againstCurrent: DiffRow[] | null;
  currentVersion: number | null;
  currentUpdatedBy: string | null;
  currentUpdatedAt: string | null;
}

export async function getReviewModel(caller: Caller, id: string, deps: ProposalDeps): Promise<ReviewModel> {
  if (!isOrgAdmin(caller)) throw new ForbiddenError("not_admin");
  const proposal = toDetail(await adminRow(deps, id));
  const store = new KnowledgeStore(deps.knowledge.admin, deps.knowledge.ids);
  const current = await store.fileByPath(spineSectorId, proposal.targetPath);
  const base = proposal.targetFileId === null || proposal.baseVersion === null ? "" : ((await store.versionContent(proposal.targetFileId, proposal.baseVersion, null)) ?? "");
  const againstBase = buildDiffModel(stripManagedFrontmatter(base), proposal.content);
  const moved = current !== null && (proposal.baseVersion === null || current.version > proposal.baseVersion);
  return {
    proposal,
    againstBase,
    againstCurrent: moved && current !== null ? buildDiffModel(stripManagedFrontmatter(current.content), proposal.content) : null,
    currentVersion: current?.version ?? null,
    currentUpdatedBy: current?.updatedBy ?? null,
    currentUpdatedAt: current?.updatedAt ?? null,
  };
}

export async function acceptProposal(caller: Caller, id: string, deps: ProposalDeps): Promise<{ outcome: ProposalOutcome; fileId: string; version: number; overwrittenVersion: number | null }> {
  const row = await adminRow(deps, id);
  const check = canDecide(caller, row);
  if (!check.ok) throw check.reason === "not_admin" ? new ForbiddenError("not_admin") : new ProposalError("already_decided");
  await update(deps, id, { status: "accepting", decidedBy: caller.userId });
  const claimed = await adminRow(deps, id);
  if (claimed.decidedBy !== caller.userId || claimed.status !== "accepting") throw new ProposalError("already_decided");
  const current = await new KnowledgeStore(deps.knowledge.admin, deps.knowledge.ids).fileByPath(spineSectorId, row.targetPath);
  let result;
  try {
    result = await applySpineChange(deps.knowledge, caller, { sectorId: spineSectorId, path: row.targetPath, content: row.content, baseVersion: current === null ? null : (row.baseVersion ?? current.version), baseHash: null, proposalId: id });
  } catch (error) {
    await update(deps, id, { status: "pending", decidedBy: null });
    throw error;
  }
  await update(deps, id, {
    status: "accepted",
    decidedAt: deps.now().toISOString(),
    resultFileId: result.fileId,
    resultOutcome: result.status,
    overwrittenVersion: result.overwrittenVersion,
  });
  await audit(deps, caller, "proposal.accepted", row, `${result.status} v${result.version}`);
  return { outcome: result.status, fileId: result.fileId, version: result.version, overwrittenVersion: result.overwrittenVersion };
}

export async function rejectProposal(caller: Caller, raw: { proposalId: string; note: string }, deps: ProposalDeps): Promise<void> {
  const parsed = rejectProposalSchema.safeParse(raw);
  if (!parsed.success) throw new ProposalError("invalid_input", "note");
  const row = await adminRow(deps, parsed.data.proposalId);
  const check = canDecide(caller, row);
  if (!check.ok) throw check.reason === "not_admin" ? new ForbiddenError("not_admin") : new ProposalError("already_decided");
  await update(deps, row.$id, { status: "rejected", decidedBy: caller.userId, decidedAt: deps.now().toISOString(), decisionNote: parsed.data.note });
  await audit(deps, caller, "proposal.rejected", row, parsed.data.note.slice(0, 120));
}

export async function withdrawProposal(caller: Caller, id: string, deps: ProposalDeps): Promise<void> {
  const row = await adminRow(deps, id);
  const check = canWithdraw(caller, row);
  if (!check.ok) throw check.reason === "not_proposer" ? new ProposalError("not_found") : new ProposalError("already_decided");
  await update(deps, id, { status: "withdrawn", decidedAt: deps.now().toISOString() });
  await audit(deps, caller, "proposal.withdrawn", row);
}

