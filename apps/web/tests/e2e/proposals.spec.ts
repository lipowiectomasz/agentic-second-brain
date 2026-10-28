import { expect, test } from "@playwright/test";
import { readAccounts } from "./accounts";
import { signedInPage } from "./session";

test("a member proposes a standard, an admin reviews the diff and accepts it, and the member sees it published", async ({ browser }) => {
  const { member, admin } = await readAccounts();
  const target = `standards/e2e-review-${Date.now()}.md`;
  const page = await signedInPage(browser, member);
  await page.goto("/proposals");
  await expect(page.getByRole("heading", { level: 1, name: "Proposals" })).toBeVisible();
  await page.getByRole("link", { name: "New proposal" }).first().click();
  await page.getByLabel("Title").fill("Code review");
  await page.getByLabel("Target path").fill(target);
  await page.getByLabel("Content · Markdown").fill("# Code review\n\nEvery change gets one approving review before merge.\n");
  await page.getByLabel("Rationale").fill("Atlas has done this for a year and it caught real bugs.");
  await expect(page.getByRole("region", { name: "Preview" }).getByText("Every change gets one approving review")).toBeAttached();
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expect(page.getByText("Proposal submitted. An admin will review it.")).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(target) });
  await expect(row.getByText("Pending")).toBeVisible();

  const adminPage = await signedInPage(browser, admin);
  await adminPage.goto("/admin/proposals");
  await expect(adminPage.getByRole("navigation", { name: "Admin" }).locator(".count")).toHaveAttribute("aria-label", /\d+ pending/);
  await adminPage.getByRole("link", { name: /Code review by e2e-member/ }).first().click();
  await expect(adminPage.getByText("Rationale · e2e-member")).toBeVisible();
  const diff = adminPage.getByLabel(`Changes to ${target}`);
  await expect(diff.locator(".diff-row.diff-add").first()).toContainText("Added:");
  await adminPage.getByRole("button", { name: "Accept" }).click();
  await expect(adminPage.getByText("Accepted and published to the spine.")).toBeVisible();

  await page.reload();
  const accepted = page.getByRole("row", { name: new RegExp(target) });
  await expect(accepted.getByText("Accepted", { exact: true })).toBeVisible();
  await accepted.getByRole("link", { name: "View in spine" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Code review" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Propose a change" })).toBeVisible();
});

test("an admin rejects a proposal with a note that the member reads, and a member can withdraw", async ({ browser }) => {
  const { member, admin } = await readAccounts();
  const page = await signedInPage(browser, member);
  for (const name of ["rejected", "withdrawn"]) {
    await page.goto("/proposals/new");
    await page.getByLabel("Title").fill(`E2E ${name}`);
    await page.getByLabel("Target path").fill(`standards/e2e-${name}-${Date.now()}.md`);
    await page.getByLabel("Content · Markdown").fill(`# E2E ${name}\n\nText.\n`);
    await page.getByLabel("Rationale").fill("Testing the review flow.");
    await page.getByRole("button", { name: "Submit proposal" }).click();
    await expect(page.getByText("Proposal submitted.")).toBeVisible();
  }
  const adminPage = await signedInPage(browser, admin);
  await adminPage.goto("/admin/proposals");
  await adminPage.getByRole("link", { name: /E2E rejected by e2e-member/ }).first().click();
  await adminPage.getByRole("button", { name: "Reject" }).click();
  const dialog = adminPage.getByRole("dialog", { name: "Reject proposal" });
  await dialog.getByLabel("Tell the author why").fill("Already covered by the release procedure.");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(adminPage.getByText("“Already covered by the release procedure.”")).toBeVisible();

  await page.goto("/proposals");
  await expect(page.getByRole("row", { name: /E2E rejected/ }).getByText("“Already covered by the release procedure.”")).toBeVisible();
  const pending = page.getByRole("row", { name: /E2E withdrawn/ });
  await pending.getByRole("button", { name: "Withdraw" }).click();
  await page.getByRole("dialog", { name: "Withdraw this proposal?" }).getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByRole("row", { name: /E2E withdrawn/ }).getByText("Withdrawn", { exact: true })).toBeVisible();
});
