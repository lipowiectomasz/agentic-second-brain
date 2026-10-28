export const exitCodes = {
  ok: 0,
  unexpected: 1,
  usage: 2,
  secret: 3,
  unsafePath: 4,
  scope: 5,
  auth: 8,
  rateLimited: 9,
  unreachable: 10,
  rejected: 11,
} as const;

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = "CliError";
  }
}
