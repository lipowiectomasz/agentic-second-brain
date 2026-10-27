import { accessRequestsTable } from "./access-requests";
import { chunksCollection } from "./chunks";
import { docReservationsTable, fileVersionsTable, filesTable } from "./files";
import { healthFunction } from "./functions";
import { sectorsTable } from "./sectors";
import type { SchemaSpec } from "./types";

export const schema: SchemaSpec = {
  collections: [chunksCollection],
  tables: [sectorsTable, filesTable, fileVersionsTable, docReservationsTable, accessRequestsTable],
  functions: [healthFunction],
};

export { documentStatuses } from "./files";
export type * from "./types";
