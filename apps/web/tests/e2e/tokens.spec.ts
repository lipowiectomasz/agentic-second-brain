import { expect, test } from "@playwright/test";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

test("members create a token, see it once, and revoke it; admins see every token", async ({ browser }) => {
  const { member, admin } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.goto("/settings/tokens");
  await expect(page.getByRole("heading", { level: 1, name: "Access tokens" })).toBeVisible();

  const name = `e2e-cli-${Date.now()}`;
  await page.getByLabel("Name").fill(name);
  await page.getByRole("radio", { name: "Read and write" }).click();
  await page.getByRole("radio", { name: "7 days" }).click();
  await page.getByRole("button", { name: "Create token" }).click();

  const reveal = page.getByRole("dialog", { name: "Copy your new token" });
  await expect(reveal).toBeVisible();
  await expect(reveal.getByText("This token will not be shown again.")).toBeVisible();
  const value = (await reveal.getByLabel("New token").textContent()) ?? "";
  expect(value).toMatch(/^cbt_[a-z2-7]{8}_[A-Za-z0-9_-]{43}$/);
  await reveal.getByRole("button", { name: "I’ve stored it" }).click();
  await expect(reveal).toBeHidden();

  await page.reload();
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText(value.slice(0, 12));
  await expect(row).toContainText("Read and write");
  await expect(row).toContainText("Never");
  await expect(row.getByText("Active")).toBeVisible();
  expect(await page.content()).not.toContain(value.slice(13));

  const adminPage = await signedInPage(browser, admin);
  await adminPage.goto("/admin/tokens");
  await expect(adminPage.getByRole("row", { name: new RegExp(name) })).toContainText("e2e-member");

  await row.getByRole("button", { name: `Revoke ${name}` }).click();
  const confirm = page.getByRole("alertdialog", { name: "Revoke this token?" });
  await expect(confirm).toContainText(value.slice(0, 12));
  await confirm.getByRole("button", { name: "Revoke token" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) }).getByText("Revoked")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: /Revoke/ })).toHaveCount(0);
});

test("the tokens administration is closed to members", async ({ browser }) => {
  const { member } = await readAccounts();
  const page = await signedInPage(browser, member);
  await page.goto("/admin/tokens");
  await expect(page.getByRole("heading", { level: 1, name: "Tokens" })).toHaveCount(0);
});
