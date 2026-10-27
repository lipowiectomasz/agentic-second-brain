import { runTestReset } from "../src/commands/test-reset";

export default async function setup(): Promise<void> {
  const code = await runTestReset(() => undefined);
  if (code !== 0) throw new Error("Test namespace reset failed");
}
