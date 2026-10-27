import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { ConsoleApi, ConsoleApiError, ensureResource, ignoreConflict } from "../console-api";
import { upsertEnvFile } from "../env-file";
import { developmentKeyName, developmentKeyScopes } from "../key-scopes";
import { envFilePath } from "../repository-paths";

const organizationId = "cortex-org";

const bootstrapEnvSchema = z.object({
  APPWRITE_ENDPOINT: z.url(),
  APPWRITE_INTERNAL_ENDPOINT: z.url().optional(),
  APPWRITE_PROJECT_ID: z.string().regex(/^[a-z0-9-]{1,36}$/),
  CORTEX_CONSOLE_EMAIL: z.email(),
  CORTEX_CONSOLE_PASSWORD: z.string().min(12).optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
});

const sessionDurationSeconds = 604_800;
const sessionLimit = 10;

interface KeyList {
  keys: Array<{ $id: string; name: string }>;
}

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
  const parsed = bootstrapEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))].sort();
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  const env = parsed.data;
  const endpoint = env.APPWRITE_INTERNAL_ENDPOINT ?? env.APPWRITE_ENDPOINT;
  const api = new ConsoleApi(endpoint);
  const projectId = env.APPWRITE_PROJECT_ID;

  await waitForHealth(endpoint);

  const generatedPassword = env.CORTEX_CONSOLE_PASSWORD === undefined ? randomBytes(24).toString("base64url") : null;
  const password = env.CORTEX_CONSOLE_PASSWORD ?? generatedPassword ?? "";
  const account = await ignoreConflict(() =>
    api.request("create console account", {
      method: "POST",
      path: "/account",
      body: { userId: "unique()", email: env.CORTEX_CONSOLE_EMAIL, password, name: "Cortex admin" },
    }),
  );
  if (account === "exists" && generatedPassword !== null) {
    throw new Error("The console account exists but CORTEX_CONSOLE_PASSWORD is not set. Set it in the env file and run again.");
  }
  log(`console account: ${account}`);

  await api.request("create console session", {
    method: "POST",
    path: "/account/sessions/email",
    body: { email: env.CORTEX_CONSOLE_EMAIL, password },
  });

  const organization = await ensureResource(
    () => api.request("read organisation", { method: "GET", path: `/teams/${organizationId}` }),
    () => api.request("create organisation", { method: "POST", path: "/teams", body: { teamId: organizationId, name: "Cortex" } }),
  );
  log(`organisation: ${organization}`);

  const project = await ensureResource(
    () => api.request("read project", { method: "GET", path: `/organization/projects/${projectId}`, organization: organizationId }),
    () =>
      api.request("create project", {
        method: "POST",
        path: "/organization/projects",
        organization: organizationId,
        body: { projectId, name: "Cortex" },
      }),
  );
  log(`project: ${project}`);

  const platform = await ensureResource(
    () => api.request("read web platform", { method: "GET", path: "/project/platforms/localhost", project: projectId }),
    () =>
      api.request("create web platform", {
        method: "POST",
        path: "/project/platforms/web",
        project: projectId,
        body: { platformId: "localhost", name: "Local web", hostname: "localhost" },
      }),
  );
  log(`web platform: ${platform}`);

  await api.request("set session duration", {
    method: "PATCH",
    path: "/project/policies/session-duration",
    project: projectId,
    body: { duration: sessionDurationSeconds },
  });
  await api.request("set session limit", {
    method: "PATCH",
    path: "/project/policies/session-limit",
    project: projectId,
    body: { total: sessionLimit },
  });
  await api.request("enable password dictionary", {
    method: "PATCH",
    path: "/project/policies/password-dictionary",
    project: projectId,
    body: { enabled: true },
  });
  log(`auth policies: session ${sessionDurationSeconds} s, limit ${sessionLimit}, password dictionary on`);

  if (env.GITHUB_OAUTH_CLIENT_ID !== undefined && env.GITHUB_OAUTH_CLIENT_SECRET !== undefined) {
    await api.request("configure GitHub provider", {
      method: "PATCH",
      path: "/project/oauth2/github",
      project: projectId,
      body: { clientId: env.GITHUB_OAUTH_CLIENT_ID, clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET, enabled: true },
    });
    log("github provider: enabled");
  } else {
    log("github provider: skipped (no client id and secret)");
  }

  const existing = await api.request<KeyList>("list keys", {
    method: "GET",
    path: `/organization/projects/${projectId}/keys`,
    organization: organizationId,
  });
  for (const key of existing.keys.filter((candidate) => candidate.name === developmentKeyName)) {
    await api.request("delete old key", {
      method: "DELETE",
      path: `/organization/projects/${projectId}/keys/${key.$id}`,
      organization: organizationId,
    });
  }
  const key = await api.request<{ secret: string }>("create key", {
    method: "POST",
    path: `/organization/projects/${projectId}/keys`,
    organization: organizationId,
    body: { keyId: "unique()", name: developmentKeyName, scopes: developmentKeyScopes },
  });
  log(`api key: rotated (${developmentKeyScopes.length} scopes)`);

  const values: Record<string, string> = { APPWRITE_API_KEY: key.secret };
  if (generatedPassword !== null) values.CORTEX_CONSOLE_PASSWORD = generatedPassword;
  const file = envFilePath();
  const current = await readFile(file, "utf8").catch(() => "");
  await writeFile(file, upsertEnvFile(current, values), { mode: 0o600 });
  log(`wrote ${Object.keys(values).join(", ")} to ${file.split("/").pop() ?? ".env"}`);
}

async function waitForHealth(endpoint: string): Promise<void> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/health/version`, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error(`Appwrite did not answer at ${endpoint}/health/version within 180 s`);
}

main().catch((error: unknown) => {
  if (error instanceof ConsoleApiError && (error.status === 404 || error.status === 401)) {
    process.stderr.write(`${error.message}\nAutomatic bootstrap is not available on this server version. Follow "Manual bootstrap" in README.md.\n`);
    process.exit(2);
  }
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
