export interface DatabaseIds {
  vectors: string;
  tables: string;
}

export function databaseIds(namespace: string): DatabaseIds {
  return { vectors: `${namespace}_vectors`, tables: `${namespace}_tables` };
}

export function assertTestNamespace(namespace: string): void {
  if (!namespace.endsWith("_test")) {
    throw new Error(`Refusing to run against namespace "${namespace}": test namespaces must end with "_test"`);
  }
}
