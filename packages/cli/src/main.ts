import { run } from "./run";

run(process.argv.slice(2), {
  env: process.env,
  cwd: process.cwd(),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  isTty: process.stdout.isTTY === true,
}).then((code) => {
  process.exitCode = code;
});
