import { TablesDB, Teams } from "node-appwrite";
import { expect, test } from "@playwright/test";
import { databaseIds, loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

const name = `test-e2e sector ${Date.now()}`;
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

test.afterAll(async () => {
  const env = loadServerEnv(process.env);
  const admin = createAdminClient(env);
  await new TablesDB(admin).deleteRow({ databaseId: databaseIds(env.CORTEX_DATABASE_NAMESPACE).tables, tableId: "sectors", rowId: slug }).catch(() => undefined);
  await new Teams(admin).delete({ teamId: `sector-${slug}` }).catch(() => undefined);
});

test("admins manage sectors and roles, members request access and maintainers approve", async ({ browser }) => {
  const accounts = await readAccounts();
  const admin = await signedInPage(browser, accounts.admin);

  await admin.goto("/admin/sectors");
  await admin.waitForLoadState("networkidle");
  await admin.getByLabel("Name").fill(name);
  await expect(admin.getByLabel("Slug")).toHaveValue(slug);
  await admin.getByRole("button", { name: "Create sector" }).click();
  await expect(admin.getByText("Sector created.")).toBeVisible();
  await expect(admin.getByRole("cell", { name: slug })).toBeVisible();

  await admin.goto("/admin/access");
  await admin.waitForLoadState("networkidle");
  const maintainerCell = admin.getByLabel(`${accounts.maintainer.name} in ${name}`);
  await maintainerCell.selectOption("maintainer");
  await expect(maintainerCell).toBeEnabled();
  await admin.reload();
  await admin.waitForLoadState("networkidle");
  await expect(admin.getByLabel(`${accounts.maintainer.name} in ${name}`)).toHaveValue("maintainer");

  const member = await signedInPage(browser, accounts.member);
  await member.goto("/sectors");
  await member.waitForLoadState("networkidle");
  const card = member.getByRole("article", { name });
  await expect(card.getByText("No access")).toBeVisible();
  await card.getByText("Request access").click();
  await card.getByLabel("Message (optional)").fill("I work on this project");
  await card.getByRole("button", { name: "Send request" }).click();
  await expect(card.getByText("Request pending")).toBeVisible();
  await member.reload();
  await expect(member.getByRole("article", { name }).getByText("Request pending")).toBeVisible();

  const maintainer = await signedInPage(browser, accounts.maintainer);
  await expect(maintainer.getByRole("link", { name: "Requests" })).toBeVisible();
  await maintainer.goto("/requests");
  await maintainer.waitForLoadState("networkidle");
  const request = maintainer.getByRole("listitem").filter({ hasText: accounts.member.name });
  await expect(request.getByText("I work on this project")).toBeVisible();
  await request.getByRole("button", { name: "Approve" }).click();
  await expect(maintainer.getByRole("listitem").filter({ hasText: accounts.member.name })).toHaveCount(0);

  await member.reload();
  await expect(member.getByRole("article", { name }).getByText("Your role: Reader")).toBeVisible();

  await admin.reload();
  await admin.waitForLoadState("networkidle");
  const memberCell = admin.getByLabel(`${accounts.member.name} in ${name}`);
  await expect(memberCell).toHaveValue("reader");
  await memberCell.selectOption("none");
  await expect(memberCell).toBeEnabled();
  await member.reload();
  await expect(member.getByRole("article", { name }).getByText("No access")).toBeVisible();
});
