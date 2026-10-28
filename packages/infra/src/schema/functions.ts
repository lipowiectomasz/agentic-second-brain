import { gatewayFunctionId } from "@cortex/config";
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

export function gatewayFunction(namespace: string, apiEndpoint?: string, maxPendingProposals?: number): FunctionSpec {
  return {
    id: gatewayFunctionId(namespace),
    name: `CLI gateway (${namespace})`,
    entry: "functions/cli-gateway/src/main.ts",
    runtime: "node-22",
    scopes: ["rows.read", "rows.write", "users.read", "users.write", "sessions.write", "teams.read", "vectorsdb.documents.read", "vectorsdb.documents.write", "embeddings.write"],
    execute: ["any"],
    timeout: 30,
    logging: false,
    variables: { CORTEX_DATABASE_NAMESPACE: namespace, ...(apiEndpoint === undefined ? {} : { CORTEX_API_ENDPOINT: apiEndpoint }), ...(maxPendingProposals === undefined ? {} : { CORTEX_MAX_PENDING_PROPOSALS: String(maxPendingProposals) }) },
  };
}
