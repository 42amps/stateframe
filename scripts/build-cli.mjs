import { chmod } from "node:fs/promises";

import { build } from "esbuild";

await build({
  entryPoints: ["cli/index.ts"],
  outfile: "dist/cli/index.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  logLevel: "info",
});

await chmod("dist/cli/index.js", 0o755);
