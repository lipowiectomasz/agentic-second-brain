import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:13020",
    trace: "retain-on-failure",
  },
  outputDir: "../../.playwright/results",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
