import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: { "@/lib": fileURLToPath(new URL("./lib", import.meta.url)) },
  },
  test: {
    include: [
      "tests/routeverity/**/*.test.ts",
      "tests/misc/create-id.test.ts",
      "tests/misc/safe-decode-uri-component.test.ts",
      "tests/misc/ip-cidr.test.ts",
      "tests/tokens/get-granted-scopes-for-role.test.ts",
    ],
    reporters: ["verbose"],
  },
});
