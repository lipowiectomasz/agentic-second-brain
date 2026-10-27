interface BaseColumn {
  key: string;
  required: boolean;
}

export interface VarcharColumn extends BaseColumn {
  type: "varchar";
  size: number;
}

export interface TextColumn extends BaseColumn {
  type: "text" | "mediumtext";
}

export interface EnumColumn extends BaseColumn {
  type: "enum";
  elements: readonly string[];
}

export interface IntegerColumn extends BaseColumn {
  type: "integer";
  min?: number;
  max?: number;
}

export interface BooleanColumn extends BaseColumn {
  type: "boolean";
}

export interface DatetimeColumn extends BaseColumn {
  type: "datetime";
}

export type ColumnSpec = VarcharColumn | TextColumn | EnumColumn | IntegerColumn | BooleanColumn | DatetimeColumn;

export interface IndexSpec {
  key: string;
  type: "key" | "unique";
  columns: string[];
}

export interface TableSpec {
  id: string;
  name: string;
  columns: ColumnSpec[];
  indexes: IndexSpec[];
}

export interface VectorIndexSpec {
  key: string;
  type: "hnsw_cosine";
}

export interface CollectionSpec {
  id: string;
  name: string;
  dimension: number;
  indexes: VectorIndexSpec[];
}

export interface FunctionSpec {
  id: string;
  name: string;
  entry: string;
  runtime: "node-22";
  scopes: string[];
  execute: string[];
  timeout: number;
  logging: boolean;
  variables: Record<string, string>;
}

export interface SchemaSpec {
  collections: CollectionSpec[];
  tables: TableSpec[];
  functions: FunctionSpec[];
}
