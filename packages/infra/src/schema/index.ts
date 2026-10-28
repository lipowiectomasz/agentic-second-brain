import { accessRequestsTable } from "./access-requests";
import { chunksCollection } from "./chunks";
import { cliTokensTable, tokenFailuresTable } from "./cli-tokens";
import { docReservationsTable, fileVersionsTable, filesTable } from "./files";
import { gatewayFunction, healthFunction } from "./functions";
import { sectorsTable } from "./sectors";
import type { SchemaSpec } from "./types";

export function schemaFor(namespace: string, options: { functionApiEndpoint?: string } = {}): SchemaSpec {
  return {
    collections: [chunksCollection],
    tables: [sectorsTable, filesTable, fileVersionsTable, docReservationsTable, accessRequestsTable, cliTokensTable, tokenFailuresTable],
    functions: [healthFunction, gatewayFunction(namespace, options.functionApiEndpoint)],
  };
}

export type * from "./types";
