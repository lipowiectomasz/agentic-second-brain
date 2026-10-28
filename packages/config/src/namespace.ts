export interface DatabaseIds {
  vectors: string;
  tables: string;
}

export function databaseIds(namespace: string): DatabaseIds {
  return { vectors: `${namespace}_vectors`, tables: `${namespace}_tables` };
}

export const defaultNamespace = "cortex";

export function gatewayFunctionId(namespace: string): string {
  return namespace === defaultNamespace ? "cli-gateway" : `cli-gateway-${namespace.replace(/_/g, "-")}`;
}

export function assertTestNamespace(namespace: string): void {
  if (!namespace.endsWith("_test")) {
    throw new Error(`Refusing to run against namespace "${namespace}": test namespaces must end with "_test"`);
  }
}
