import type { Browser, Page } from "@playwright/test";
import type { E2eAccount } from "./accounts";

export async function signedInPage(browser: Browser, account: E2eAccount): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  return page;
}
