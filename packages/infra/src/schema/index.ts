import { accessRequestsTable } from "./access-requests";
import { chunksCollection } from "./chunks";
import { cliTokensTable, tokenFailuresTable } from "./cli-tokens";
import { docReservationsTable, fileVersionsTable, filesTable } from "./files";
import { gatewayFunction, healthFunction } from "./functions";
import { proposalsTable } from "./proposals";
import { sectorsTable } from "./sectors";
import type { SchemaSpec } from "./types";

export function schemaFor(namespace: string, options: { functionApiEndpoint?: string; maxPendingProposals?: number } = {}): SchemaSpec {
  return {
    collections: [chunksCollection],
    tables: [sectorsTable, filesTable, fileVersionsTable, docReservationsTable, accessRequestsTable, cliTokensTable, tokenFailuresTable, proposalsTable],
    functions: [healthFunction, gatewayFunction(namespace, options.functionApiEndpoint, options.maxPendingProposals)],
  };
}

export type * from "./types";
