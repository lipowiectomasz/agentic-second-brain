import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/*/src/**/*.test.ts", "functions/*/src/**/*.test.ts", "apps/web/lib/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["packages/*/test/**/*.integration.test.ts"],
          globalSetup: ["packages/infra/test/global-setup.ts"],
          environment: "node",
          testTimeout: 120000,
          hookTimeout: 180000,
          fileParallelism: false,
        },
      },
    ],
  },
});
