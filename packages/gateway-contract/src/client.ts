import type { z } from "zod";
import { errorBodySchema } from "./envelope";
import type { ErrorBody } from "./envelope";

export interface GatewayTarget {
  endpoint: string;
  projectId: string;
  functionId: string;
  headers?: Record<string, string>;
}

export type GatewayResult<T> = { status: number; ok: true; data: T } | { status: number; ok: false; error: ErrorBody["error"] };

interface ExecutionResponse {
  responseStatusCode?: number;
  responseBody?: string;
  message?: string;
}

export async function callGateway<D>(
  target: GatewayTarget,
  route: { path: string; output: z.ZodType<{ ok: true; data: D }> },
  auth: string,
  input: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<GatewayResult<D>> {
  const response = await fetchImpl(`${target.endpoint.replace(/\/$/, "")}/functions/${target.functionId}/executions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-appwrite-project": target.projectId, ...target.headers },
    body: JSON.stringify({ body: JSON.stringify({ auth, input }), async: false, path: route.path, method: "POST", headers: { "content-type": "application/json" } }),
  });
  const execution = (await response.json()) as ExecutionResponse;
  if (!response.ok || execution.responseStatusCode === undefined) {
    return { status: response.status, ok: false, error: { code: "internal", message: (execution.message ?? "The gateway is unreachable.").slice(0, 300) } };
  }
  const status = execution.responseStatusCode;
  let body: unknown;
  try {
    body = JSON.parse(execution.responseBody ?? "");
  } catch {
    return { status, ok: false, error: { code: "internal", message: "The gateway returned an unreadable response." } };
  }
  const failure = errorBodySchema.safeParse(body);
  if (failure.success) return { status, ok: false, error: failure.data.error };
  return { status, ok: true, data: route.output.parse(body).data };
}
