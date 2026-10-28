import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

async function openSearch(page: Page, query: string) {
  await page.keyboard.press("Control+k");
  await page.getByLabel("Search query").fill(query);
  return page.getByRole("listbox", { name: "Search results" });
}

test("a sealed spec shows its findings and links to the spec it replaced", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.waitForLoadState("networkidle");

  const results = await openSearch(page, "carrier label requests with exponential backoff");
  await results.getByRole("option", { name: /Carrier label backoff/ }).first().click();
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Carrier label backoff" })).toBeVisible();
  await expect(main.getByText("SPEC-002", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("Approved", { exact: true })).toBeVisible();
  await expect(main.getByLabel("Sealed, cannot be edited")).toBeVisible();
  await expect(main.getByText("v2 · 1 earlier version")).toBeVisible();
  const findings = main.getByRole("region", { name: "Findings · 2" });
  await expect(findings.getByRole("link")).toHaveCount(2);
  await expect(findings.getByRole("link", { name: /Carrier rate limits/ })).toBeVisible();

  await main.getByRole("link", { name: "SPEC-001" }).click();
  await expect(main.getByRole("heading", { level: 1, name: "Carrier label retries" })).toBeVisible();
  await expect(main.getByText("Superseded", { exact: true })).toBeVisible();
  await expect(main.getByText(/This document was superseded by/)).toBeVisible();
  await expect(main.getByRole("region", { name: /Findings/ })).toHaveCount(0);

  await main.getByRole("link", { name: "Open SPEC-002" }).click();
  await expect(main.getByRole("heading", { level: 1, name: "Carrier label backoff" })).toBeVisible();
});

test("the palette shows superseded documents dimmed only when asked", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.waitForLoadState("networkidle");

  const results = await openSearch(page, "retry carrier label requests three times with a fixed pause");
  await expect(results.getByRole("option").first()).toBeVisible({ timeout: 15_000 });
  await expect(results.getByRole("option", { name: /Carrier label retries/ })).toHaveCount(0);

  const toggle = page.getByRole("switch", { name: "Include superseded" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  const stale = results.getByRole("option", { name: /Carrier label retries/ });
  await expect(stale).toBeVisible({ timeout: 15_000 });
  await expect(stale.getByText("Superseded")).toBeVisible();
  await expect(stale.getByText("SPEC-001", { exact: true })).toBeVisible();
  await expect(stale).toHaveClass(/is-dim/);
});

test("on a phone the navigation opens in a sheet with the admin links", async ({ browser }) => {
  const { admin } = await readAccounts();
  const page = await signedInPage(browser, admin);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/sectors");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  const sheet = page.getByRole("dialog", { name: "Menu" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Sectors" }).first()).toHaveAttribute("aria-current", "page");
  await expect(sheet.getByText("Admin", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Access" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await sheet.getByRole("link", { name: "Access" }).click();
  await expect(page).toHaveURL(/\/admin\/access$/);
  await expect(sheet).toBeHidden();
});
