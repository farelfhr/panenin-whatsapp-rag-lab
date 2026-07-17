import { build } from "esbuild";

await build({
  entryPoints: ["dist/index.js"],
  outfile: "dist/index.bundle.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  sourcemap: true,
  external: ["openclaw/*"],
  logLevel: "warning",
});
