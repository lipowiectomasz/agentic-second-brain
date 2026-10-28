import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CliError, exitCodes } from "../errors";

export function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export function toToolError(error: unknown): CallToolResult {
  if (error instanceof CliError) {
    if (error.exitCode === exitCodes.auth) return errorResult("The Cortex token is missing, expired or revoked. Run `cortex login` with a new token.");
    if (error.exitCode === exitCodes.rateLimited) return errorResult(error.message);
    if (error.exitCode === exitCodes.unreachable) return errorResult("The Cortex server did not respond. Check that it is running.");
    if (error.gatewayCode === "not_found") return errorResult("No readable file matches. It may have been deleted or you may have lost access.");
    return errorResult(`Cortex returned ${error.gatewayCode ?? "an error"}: ${error.message}`);
  }
  return errorResult("The Cortex server did not respond. Check that it is running.");
}
