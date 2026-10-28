import { expect, test } from "@playwright/test";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

test("admins see who changed what and can narrow the log, members cannot open it", async ({ browser }) => {
  const { admin, member } = await readAccounts();
  const page = await signedInPage(browser, admin);
  const slug = `e2e-audit-${Date.now()}`;
  await page.goto("/admin/sectors");
  await page.getByLabel("Name").fill(`E2E Audit ${slug.slice(-4)}`);
  await page.getByLabel("Slug").fill(slug);
  await page.getByRole("button", { name: "Create sector" }).click();
  await expect(page.getByText("Sector created.")).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(`sector:${slug}`) });
  await expect(row.getByText("Sector created")).toBeVisible();
  await expect(row.getByText("e2e-admin")).toBeVisible();

  await page.getByLabel("Event").selectOption("token.created");
  await expect(page).toHaveURL(/action=token.created/);
  await expect(page.getByRole("row", { name: new RegExp(`sector:${slug}`) })).toHaveCount(0);

  const memberPage = await signedInPage(browser, member);
  await memberPage.goto("/admin/audit");
  await expect(memberPage.getByRole("heading", { level: 1, name: "Audit log" })).toHaveCount(0);
});
