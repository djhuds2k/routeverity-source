// Modified for RouteVerity, 2026-10-06 through 2026-10-17. See root NOTICE.md.
import { defineConfig, Options } from "tsup";

export default defineConfig((options: Options) => ({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  dts: true,
  minify: true,
  metafile: process.env.ROUTEVERITY_LICENSE_AUDIT === "1",
  clean: process.env.VERCEL === "1",
  external: ["react"],
  ...options,
}));
