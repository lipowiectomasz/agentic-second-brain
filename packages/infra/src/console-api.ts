import { withTimeout } from "@cortex/server-kit";

export class ConsoleApiError extends Error {
  constructor(readonly status: number, readonly type: string, readonly operation: string) {
    super(`${operation} failed with ${status} ${type}`);
    this.name = "ConsoleApiError";
  }
}

interface RequestOptions {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  project?: string;
  organization?: string;
}

export class ConsoleApi {
  private sessionCookie: string | null = null;

  constructor(private readonly endpoint: string) {}

  async request<T>(operation: string, options: RequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Appwrite-Project": options.project ?? "console",
    };
    if (options.project !== undefined) headers["X-Appwrite-Mode"] = "admin";
    if (options.organization !== undefined) headers["X-Appwrite-Organization"] = options.organization;
    if (this.sessionCookie !== null) headers.Cookie = this.sessionCookie;
    const response = await withTimeout(operation, () =>
      fetch(`${this.endpoint}${options.path}`, {
        method: options.method,
        headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      }),
    );
    const sessionHeader = response.headers.getSetCookie().find((cookie) => cookie.startsWith("a_session_console="));
    if (sessionHeader !== undefined) {
      this.sessionCookie = sessionHeader.split(";", 1)[0] ?? null;
    }
    const text = await response.text();
    const payload: unknown = text === "" ? {} : JSON.parse(text);
    if (!response.ok) {
      const type = typeof payload === "object" && payload !== null && "type" in payload ? String(payload.type) : "unknown";
      throw new ConsoleApiError(response.status, type, operation);
    }
    return payload as T;
  }
}

const existingResourceTypes = new Set(["user_console_count_exceeded"]);

export function isExistingResource(error: unknown): boolean {
  return error instanceof ConsoleApiError && (error.status === 409 || existingResourceTypes.has(error.type));
}

export async function ignoreConflict(run: () => Promise<unknown>): Promise<"created" | "exists"> {
  try {
    await run();
    return "created";
  } catch (error) {
    if (isExistingResource(error)) return "exists";
    throw error;
  }
}

export async function ensureResource(exists: () => Promise<unknown>, create: () => Promise<unknown>): Promise<"created" | "exists"> {
  try {
    await exists();
    return "exists";
  } catch (error) {
    if (!(error instanceof ConsoleApiError) || error.status !== 404) throw error;
  }
  await create();
  return "created";
}
