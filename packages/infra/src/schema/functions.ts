import type { FunctionSpec } from "./types";

export const healthFunction: FunctionSpec = {
  id: "health",
  name: "Health",
  entry: "functions/health/src/main.ts",
  runtime: "node-22",
  scopes: [],
  execute: [],
  timeout: 15,
  logging: true,
  variables: {},
};
