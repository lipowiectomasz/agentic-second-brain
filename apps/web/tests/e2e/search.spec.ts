import { expect, test } from "@playwright/test";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

test("members search by meaning, open the section and see related thoughts", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.waitForLoadState("networkidle");

  await page.keyboard.press("Control+k");
  const input = page.getByLabel("Search query");
  await expect(input).toBeFocused();
  await expect(page.getByText("Ask anything about your brain").last()).toBeVisible();

  await input.fill("how do I undo a broken release");
  const results = page.getByRole("listbox", { name: "Search results" });
  await expect(results.getByRole("option").first()).toBeVisible({ timeout: 15_000 });
  await expect(results.getByRole("option", { name: /Rolling back a failed deployment/ })).toBeVisible();
  await expect(results.getByText(/% match/).first()).toBeVisible();

  await page.getByRole("button", { name: "backlog", exact: true }).click();
  await expect(page.getByText("No matches. Try describing the problem in other words.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "backlog", exact: true }).click();
  await page.getByRole("button", { name: "note", exact: true }).click();
  await expect(results.getByRole("option").first()).toBeVisible({ timeout: 15_000 });

  await results.getByRole("option", { name: /Rolling back a failed deployment/ }).first().click();
  await expect(page).toHaveURL(/\/files\/[^#]+#rolling-back-a-failed-deployment$/);
  await expect(page.getByRole("heading", { level: 1, name: "Rolling back a failed deployment" }).last()).toBeVisible();
  await expect(page.getByRole("main").getByText("notes/rollback.md")).toBeVisible();

  const panel = page.getByRole("complementary", { name: "Related thoughts" });
  await expect(panel.getByRole("link").first()).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByRole("link", { name: /Reverting a broken release/ })).toBeVisible();
  await expect(panel.getByRole("link", { name: /Rolling back a failed deployment/ })).toHaveCount(0);
});

test("a file outside the member's sectors is not found", async ({ browser }) => {
  const { maintainer } = await readAccounts();
  const page = await signedInPage(browser, maintainer);
  await page.goto("/files/does-not-exist");
  await expect(page.getByText("This file does not exist or you do not have access.")).toBeVisible();
});
