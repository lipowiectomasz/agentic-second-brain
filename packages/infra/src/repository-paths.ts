import path from "node:path";

export const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

export function envFilePath(): string {
  const name = process.env.CORTEX_ENV_FILE ?? ".env";
  if (name.includes("/") || !name.startsWith(".env")) {
    throw new Error(`Invalid env file name: ${name}`);
  }
  return path.join(repositoryRoot, name);
}
