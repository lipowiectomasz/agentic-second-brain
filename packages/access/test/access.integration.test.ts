import { ID, Permission, Role, TablesDB } from "node-appwrite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sectorReadPermissions } from "@cortex/core";
import {
  AlreadyMemberError,
  ForbiddenError,
  RequestAlreadyDecidedError,
  RequestPendingError,
  SlugTakenError,
  createSector,
  decideRequest,
  getAccessMatrix,
  getSectorRole,
  listPendingRequests,
  listSectorSummaries,
  listSectorsForCaller,
  requestAccess,
  setOrgAdmin,
  setRole,
} from "../src";
import type { TestMember } from "./helpers";
import { admin, createMember, deleteMembers, deleteSector, ids, stamp, testDeps } from "./helpers";


const deps = testDeps();
const slug = `test-${stamp}`;
let boss: TestMember;
let maintainer: TestMember;
let reader: TestMember;
let outsider: TestMember;

beforeAll(async () => {
  boss = await createMember("boss", ["admin"]);
  maintainer = await createMember("maint");
  reader = await createMember("reader");
  outsider = await createMember("outsider");
});

afterAll(async () => {
  await deleteSector(slug);
  await deleteMembers([boss, maintainer, reader, outsider]);
});

describe("sectors and access", () => {
  it("lets an admin create a sector and refuses a duplicate slug and non-admins", async () => {
    const view = await createSector(boss.caller, { name: `test sector ${stamp}`, slug, color: "sector-2" }, deps);
    expect(view).toMatchObject({ id: slug, kind: "project", color: "#4a4ea0" });
    await expect(createSector(boss.caller, { name: "again", slug, color: "sector-1" }, deps)).rejects.toBeInstanceOf(SlugTakenError);
    await expect(createSector(maintainer.caller, { name: "nope", slug: `${slug}-x`, color: "sector-1" }, deps)).rejects.toBeInstanceOf(ForbiddenError);
    expect(deps.audit.events.map((event) => event.action)).toContain("sector.created");
  });

  it("lists the sector for every member with their role", async () => {
    const views = await listSectorsForCaller(outsider.caller, outsider.sessionTables, deps);
    const spine = views.find((view) => view.kind === "spine");
    const sector = views.find((view) => view.id === slug);
    expect(spine?.myRole).toBe("spine-reader");
    expect(sector).toMatchObject({ myRole: null, myRequest: null });
  });

  it("applies the role rules for admins and maintainers", async () => {
    await setRole(boss.caller, { userId: maintainer.caller.userId, sectorId: slug, role: "maintainer" }, deps);
    expect(await getSectorRole(maintainer.caller, slug, deps)).toBe("maintainer");

    await setRole(maintainer.caller, { userId: reader.caller.userId, sectorId: slug, role: "reader" }, deps);
    expect(await getSectorRole(reader.caller, slug, deps)).toBe("reader");

    await expect(setRole(maintainer.caller, { userId: outsider.caller.userId, sectorId: slug, role: "maintainer" }, deps)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setRole(reader.caller, { userId: outsider.caller.userId, sectorId: slug, role: "reader" }, deps)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setRole(boss.caller, { userId: reader.caller.userId, sectorId: "spine", role: "reader" }, deps)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("shows the members and roles in the matrix and the counts in the summaries", async () => {
    const matrix = await getAccessMatrix(boss.caller, deps);
    const row = matrix.rows.find((entry) => entry.userId === maintainer.caller.userId);
    expect(row?.roles[slug]).toBe("maintainer");
    expect(matrix.rows.find((entry) => entry.userId === boss.caller.userId)?.isOrgAdmin).toBe(true);
    const summary = (await listSectorSummaries(boss.caller, deps)).find((entry) => entry.id === slug);
    expect(summary).toMatchObject({ fileCount: 0, memberCount: 2 });
    await expect(getAccessMatrix(maintainer.caller, deps)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("runs the access request lifecycle with row permissions enforced by Appwrite", async () => {
    await expect(requestAccess(reader.caller, { sectorId: slug, role: "reader" }, deps)).rejects.toBeInstanceOf(AlreadyMemberError);
    await requestAccess(outsider.caller, { sectorId: slug, role: "reader", message: "please" }, deps);
    await expect(requestAccess(outsider.caller, { sectorId: slug, role: "reader" }, deps)).rejects.toBeInstanceOf(RequestPendingError);

    const ownView = (await listSectorsForCaller(outsider.caller, outsider.sessionTables, deps)).find((view) => view.id === slug);
    expect(ownView?.myRequest?.status).toBe("pending");

    const forMaintainer = await listPendingRequests(maintainer.caller, maintainer.sessionTables, deps);
    const forAdmin = await listPendingRequests(boss.caller, boss.sessionTables, deps);
    const forReader = await listPendingRequests(reader.caller, reader.sessionTables, deps);
    const request = forMaintainer.find((entry) => entry.sector.id === slug);
    expect(request?.message).toBe("please");
    expect(forAdmin.some((entry) => entry.id === request?.id)).toBe(true);
    expect(forReader.some((entry) => entry.id === request?.id)).toBe(false);

    if (request === undefined) throw new Error("request not visible to the maintainer");
    await expect(decideRequest(reader.caller, { requestId: request.id, decision: "approve" }, deps)).rejects.toBeInstanceOf(ForbiddenError);
    await decideRequest(maintainer.caller, { requestId: request.id, decision: "approve" }, deps);
    expect(await getSectorRole(outsider.caller, slug, deps)).toBe("reader");
    await expect(decideRequest(boss.caller, { requestId: request.id, decision: "reject" }, deps)).rejects.toBeInstanceOf(RequestAlreadyDecidedError);
  });

  it("revokes read access immediately when the role is removed", async () => {
    const tables = new TablesDB(admin);
    const rowId = ID.unique();
    await tables.createRow({
      databaseId: ids.tables,
      tableId: "files",
      rowId,
      data: { sectorId: slug, path: "notes/a.md", title: "A", kind: "note", hash: "0".repeat(64), version: 1, size: 1, content: "a", updatedBy: boss.caller.userId, authorId: boss.caller.userId },
      permissions: [...sectorReadPermissions({ kind: "project", teamId: `sector-${slug}` }), Permission.delete(Role.label("admin"))],
    });
    await expect(outsider.sessionTables.getRow({ databaseId: ids.tables, tableId: "files", rowId })).resolves.toMatchObject({ $id: rowId });
    await setRole(boss.caller, { userId: outsider.caller.userId, sectorId: slug, role: null }, deps);
    await expect(outsider.sessionTables.getRow({ databaseId: ids.tables, tableId: "files", rowId })).rejects.toMatchObject({ code: 404 });
    await tables.deleteRow({ databaseId: ids.tables, tableId: "files", rowId });
  });

  it("toggles the org admin label", async () => {
    await setOrgAdmin(boss.caller, { userId: maintainer.caller.userId, isAdmin: true }, deps);
    await setOrgAdmin(boss.caller, { userId: maintainer.caller.userId, isAdmin: false }, deps);
    await expect(setOrgAdmin(maintainer.caller, { userId: boss.caller.userId, isAdmin: false }, deps)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
