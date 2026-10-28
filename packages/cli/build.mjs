import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/cortex.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  legalComments: "none",
  banner: { js: "#!/usr/bin/env node\nimport { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});
