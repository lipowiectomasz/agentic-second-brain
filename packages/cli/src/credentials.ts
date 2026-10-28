import { chmod, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CliError, exitCodes } from "./errors";

export const credentialsSchema = z.object({
  schema: z.literal(1),
  endpoint: z.url(),
  projectId: z.string().regex(/^[a-z0-9-]{1,36}$/),
  functionId: z.string().regex(/^[a-zA-Z0-9._-]{1,36}$/),
  token: z.string().length(56),
  userId: z.string(),
  name: z.string(),
  scope: z.enum(["read", "write"]),
  expiresAt: z.string(),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export function defaultCredentialsFile(env: NodeJS.ProcessEnv): string {
  if (env.CORTEX_CREDENTIALS_FILE !== undefined && env.CORTEX_CREDENTIALS_FILE !== "") return env.CORTEX_CREDENTIALS_FILE;
  const base = env.XDG_CONFIG_HOME !== undefined && env.XDG_CONFIG_HOME !== "" ? env.XDG_CONFIG_HOME : path.join(env.HOME ?? ".", ".config");
  return path.join(base, "cortex", "credentials.json");
}

export async function readCredentials(file: string): Promise<Credentials> {
  let info;
  try {
    info = await stat(file);
  } catch {
    throw new CliError("Not signed in. Run: cortex login --endpoint <url> --project <id>", exitCodes.auth);
  }
  if ((info.mode & 0o077) !== 0) throw new CliError(`Credentials file ${file} is readable by others. Run: chmod 600 ${file}`, exitCodes.auth);
  const parsed = credentialsSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
  if (!parsed.success) throw new CliError("The credentials file is damaged. Run cortex login again.", exitCodes.auth);
  return parsed.data;
}

export async function writeCredentials(file: string, value: Credentials): Promise<void> {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temp, file);
}

export async function removeCredentials(file: string): Promise<boolean> {
  try {
    await unlink(file);
    return true;
  } catch {
    return false;
  }
}
