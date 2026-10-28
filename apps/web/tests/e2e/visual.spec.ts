import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

const lightBackground = "rgb(244, 239, 228)";
const darkBackground = "rgb(20, 24, 33)";

function bodyBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test("the chosen theme survives a reload and system follows the device", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForLoadState("networkidle");

  await page.getByLabel(/Account menu/).click();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect.poll(() => bodyBackground(page)).toBe(darkBackground);

  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  expect(await bodyBackground(page)).toBe(darkBackground);

  await page.getByLabel(/Account menu/).click();
  await page.getByRole("radio", { name: "System" }).click();
  await expect.poll(() => bodyBackground(page)).toBe(lightBackground);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => bodyBackground(page)).toBe(darkBackground);
});

test("pages fit a 360 px wide screen without horizontal scrolling", async ({ browser }) => {
  const { member, admin } = await readAccounts();
  const routes: Array<[Page, string]> = [];
  const memberPage = await signedInPage(browser, member);
  const adminPage = await signedInPage(browser, admin);
  for (const route of ["/", "/sectors", "/profile"]) routes.push([memberPage, route]);
  for (const route of ["/requests", "/admin/sectors", "/admin/access"]) routes.push([adminPage, route]);
  await memberPage.setViewportSize({ width: 360, height: 740 });
  await adminPage.setViewportSize({ width: 360, height: 740 });
  for (const [page, route] of routes) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
});

test("reduced motion turns transitions off", async ({ page }) => {
  await page.goto("/login");
  const signIn = page.getByRole("button", { name: "Sign in" });
  expect(await signIn.evaluate((element) => getComputedStyle(element).transitionDuration)).not.toBe("0s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await signIn.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
});

test("the search palette works from the keyboard alone", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.waitForLoadState("networkidle");

  const mapLink = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Map" });
  for (let step = 0; step < 6 && !(await mapLink.evaluate((element) => element === document.activeElement)); step += 1) await page.keyboard.press("Tab");
  await expect(mapLink).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.activeElement ?? document.body).outlineStyle)).toBe("solid");

  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search the brain" });
  await expect(dialog).toBeVisible();
  await page.keyboard.type("how do I undo a broken release");
  const options = page.getByRole("listbox", { name: "Search results" }).getByRole("option");
  await expect(options.first()).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });

  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.keyboard.press("Control+k");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/files\/[^#]+#/);
  await expect(dialog).toBeHidden();
});
