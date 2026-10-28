import { parseArgs } from "node:util";
import type { CommandEnv, Flags } from "./commands";
import { login, logout, promptHidden, pull, push, report, reserve, search, statusSet, syncContext } from "./commands";
import { defaultCredentialsFile } from "./credentials";
import { CliError, exitCodes } from "./errors";
import { withLock } from "./lock";
import { createOutput } from "./output";

export interface RunIo {
  env: NodeJS.ProcessEnv;
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  fetch?: typeof fetch;
  readStdin?: () => Promise<string>;
  isTty?: boolean;
}

const usage = `Usage: cortex <command>

  login --endpoint <url> --project <id> [--function <id>] [--token-stdin]
  logout
  status                         show what pull and push would change
  status <DOC-ID> <status>       change a document status
  pull | push [--strict] [--delete] | sync
  search "<query>" [--include-superseded]
  reserve <spec|backlog|finding> [--sector <slug>] [--create <slug>] [--relates <ID>] [--title <text>]

Global: --root <dir>, --json, --quiet`;

async function readAll(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function run(argv: string[], io: RunIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        root: { type: "string" },
        json: { type: "boolean" },
        quiet: { type: "boolean" },
        strict: { type: "boolean" },
        delete: { type: "boolean" },
        "include-superseded": { type: "boolean" },
        sector: { type: "string" },
        create: { type: "string" },
        relates: { type: "string" },
        title: { type: "string" },
        endpoint: { type: "string" },
        project: { type: "string" },
        function: { type: "string" },
        "token-stdin": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    io.stderr(`cortex: ${error instanceof Error ? error.message : "invalid arguments"}\n${usage}\n`);
    return exitCodes.usage;
  }
  const flags = parsed.values as Flags;
  const [command, ...rest] = parsed.positionals;
  const quiet = flags.quiet === true;
  const out = createOutput({ quiet, json: flags.json === true, color: io.isTty === true && (io.env.NO_COLOR ?? "") === "", stdout: io.stdout, stderr: io.stderr });
  if (command === undefined || flags.help === true) {
    io.stdout(`${usage}\n`);
    return command === undefined && flags.help !== true ? exitCodes.usage : exitCodes.ok;
  }
  const env: CommandEnv = {
    root: typeof flags.root === "string" ? flags.root : (io.env.CORTEX_ROOT ?? io.cwd),
    cwd: io.cwd,
    credentialsFile: defaultCredentialsFile(io.env),
    out,
    fetch: io.fetch ?? fetch,
    readStdin: io.readStdin ?? readAll,
    promptHidden,
  };
  try {
    switch (command) {
      case "login":
        return await login(env, flags);
      case "logout":
        return await logout(env);
      case "status":
        if (rest.length === 2) return await withLock(env.root, out.warn, () => statusSet(env, rest[0] as string, rest[1] as string));
        await report(await syncContext(env));
        return exitCodes.ok;
      case "pull":
        return await withLock(env.root, out.warn, async () => {
          await pull(await syncContext(env));
          return exitCodes.ok;
        });
      case "push":
        return await withLock(env.root, out.warn, async () => push(await syncContext(env), { strict: flags.strict === true, delete: flags.delete === true }));
      case "sync":
        return await withLock(env.root, out.warn, async () => {
          const ctx = await syncContext(env);
          await pull(ctx);
          const code = await push(ctx, { strict: flags.strict === true, delete: flags.delete === true });
          await pull(ctx);
          return code;
        });
      case "search":
        if (rest.length === 0) throw new CliError('Use: cortex search "<query>"', exitCodes.usage);
        return await search(env, flags, rest.join(" "));
      case "reserve":
        return await withLock(env.root, out.warn, () => reserve(env, flags, rest[0]));
      default:
        throw new CliError(`Unknown command ${command}.\n${usage}`, exitCodes.usage);
    }
  } catch (error) {
    if (error instanceof CliError) {
      out.error(error.message);
      if (quiet && error.exitCode !== exitCodes.auth && error.exitCode !== exitCodes.unreachable) return exitCodes.ok;
      return error.exitCode;
    }
    out.error(error instanceof Error ? `unexpected error: ${error.message}` : "unexpected error");
    return quiet ? exitCodes.ok : exitCodes.unexpected;
  }
}
