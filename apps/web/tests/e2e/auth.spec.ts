import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { E2eAccount } from "./accounts";
import { readAccounts } from "./accounts";

async function signIn(page: Page, account: E2eAccount, password = account.password): Promise<void> {
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("anonymous visitors are sent to the login page with the target path", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
});

test("a wrong password shows the generic message", async ({ page }) => {
  const { member } = await readAccounts();
  await page.goto("/login");
  await signIn(page, member, "definitely-not-the-password");
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("a member signs in, sees the profile and no admin area", async ({ page }) => {
  const { member } = await readAccounts();
  await page.goto("/profile");
  await signIn(page, member);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: member.name })).toBeVisible();
  await expect(page.getByText(member.email)).toBeVisible();
  await expect(page.getByText("Spine: Reader")).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.goto("/admin");
  await expect(page.getByText("You need organisation admin rights to open this page.")).toBeVisible();
});

test("an admin sees the admin link and the admin area", async ({ page }) => {
  const { admin } = await readAccounts();
  await page.goto("/login");
  await signIn(page, admin);
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText("Organisation admin")).toBeVisible();
});

test("signing out ends the session and the back button returns to login", async ({ page }) => {
  const { member } = await readAccounts();
  await page.goto("/login?next=%2Fprofile");
  await signIn(page, member);
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByText(member.name, { exact: true }).first().click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
});
