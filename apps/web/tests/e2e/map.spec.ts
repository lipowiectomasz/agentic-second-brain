import { expect, test } from "@playwright/test";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

test("the map shows readable files, links that follow the threshold, and opens a file", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Brain map" })).toBeVisible();
  const files = page.getByRole("region", { name: "Files on this map" }).getByRole("link");
  await expect(files.filter({ hasText: "Rolling back a failed deployment" })).toHaveCount(1);
  await expect(files.filter({ hasText: "Carrier label retries" })).toHaveCount(0);

  const slider = page.getByLabel("Similarity threshold");
  const count = page.getByTestId("edge-count");
  await slider.fill("0.45");
  const loose = Number.parseInt((await count.textContent()) ?? "0", 10);
  await slider.fill("0.9");
  const strict = Number.parseInt((await count.textContent()) ?? "0", 10);
  expect(loose).toBeGreaterThan(0);
  expect(strict).toBeLessThan(loose);

  const node = page.getByRole("link", { name: /^Rolling back a failed deployment, / }).first();
  await node.hover();
  await expect(page.getByRole("status").filter({ hasText: "notes/rollback.md" })).toBeVisible();
  await node.click();
  await expect(page).toHaveURL(/\/files\//);
  await expect(page.getByRole("heading", { level: 1, name: "Rolling back a failed deployment" })).toBeVisible();
});

test("sectors without access appear locked with a request link and no files", async ({ browser }) => {
  const { maintainer } = await readAccounts();
  const page = await signedInPage(browser, maintainer);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: "Request access to E2E Knowledge" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Files on this map" }).getByRole("link").filter({ hasText: "E2E Knowledge" })).toHaveCount(0);
});

test("the map is static under reduced motion", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForLoadState("networkidle");
  const node = page.getByRole("link", { name: /^Rolling back a failed deployment, / }).first();
  const first = await node.boundingBox();
  await page.waitForTimeout(500);
  expect(await node.boundingBox()).toEqual(first);
  expect(await page.locator(".edge-pulse").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});
