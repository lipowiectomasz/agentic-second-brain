import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readCredentials } from "../credentials";
import { CliError, exitCodes } from "../errors";
import { GatewayClient } from "../gateway-client";
import type { GatewayPort } from "./gateway-port";
import { gatewayPort } from "./gateway-port";
import { createBrainServer } from "./server";

export const cliVersion = "0.1.0";

function signedOutPort(error: unknown): GatewayPort {
  const fail = async (): Promise<never> => {
    throw error instanceof CliError ? error : new CliError("Not signed in.", exitCodes.auth);
  };
  return { search: fail, related: fail, manifest: fail, content: fail };
}

export async function runMcp(options: { credentialsFile: string; fetch: typeof fetch; log: (line: string) => void }): Promise<number> {
  let port: GatewayPort;
  try {
    const credentials = await readCredentials(options.credentialsFile);
    port = gatewayPort(new GatewayClient({ endpoint: credentials.endpoint, projectId: credentials.projectId, functionId: credentials.functionId }, credentials.token, options.fetch));
    options.log(`cortex mcp: signed in as ${credentials.name}`);
  } catch (error) {
    port = signedOutPort(error);
    options.log("cortex mcp: not signed in; tools will ask you to run cortex login");
  }
  const server = createBrainServer({ port, version: cliVersion });
  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
  await server.connect(transport);
  await closed;
  return exitCodes.ok;
}
