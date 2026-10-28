import { expect, test } from "@playwright/test";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

test("the component sheet fits a phone in both themes", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.setViewportSize({ width: 360, height: 740 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/design");
    await expect(page.getByRole("heading", { level: 1, name: "Component sheet" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), colorScheme).toBeLessThanOrEqual(0);
  }
});

test("the diff view folds unchanged lines and walks changes from the keyboard", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.goto("/design");
  const diff = page.getByLabel("Changes to standards/git-branching.md");
  await expect(diff.getByText("Change 1 of 3")).toBeVisible();
  await expect(diff.locator(".diff-row.diff-add").first()).toContainText("Added:");
  await expect(diff.locator(".diff-row.diff-del").first()).toContainText("Removed:");

  await diff.focus();
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await expect(diff.getByText("Change 3 of 3")).toBeVisible();
  await page.keyboard.press("k");
  await expect(diff.getByText("Change 2 of 3")).toBeVisible();
  await expect(diff.locator(".diff-hunk-on").first()).toContainText("Merge with a merge commit");

  const folds = diff.getByRole("button", { name: /Show \d+ unchanged lines/ });
  const before = await folds.count();
  expect(before).toBeGreaterThanOrEqual(2);
  await expect(diff.getByText("Stale branches are deleted after a week.")).toHaveCount(0);
  await folds.first().click();
  await expect(diff.getByText("Stale branches are deleted after a week.")).toBeVisible();
  await expect(folds).toHaveCount(before - 1);
});

test("the confirm popover opens and closes with Escape and the counter hides zero", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.goto("/design");
  await page.getByRole("button", { name: "Withdraw", exact: true }).first().click();
  const popover = page.getByRole("dialog", { name: "Withdraw this proposal?" });
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();

  await expect(page.locator('a[data-count="0"] .count')).toHaveCount(0);
  await expect(page.locator('a[data-count="3"] .count')).toHaveAttribute("aria-label", "3 pending");
  await expect(page.locator('a[data-count="120"] .count')).toHaveText("99+");
});
