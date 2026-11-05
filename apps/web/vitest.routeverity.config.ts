import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@/lib": fileURLToPath(new URL("./lib", import.meta.url)),
      nodemailer: createRequire(
        new URL("../../packages/email/package.json", import.meta.url),
      ).resolve("nodemailer"),
      "@dub/email/smtp-notification": fileURLToPath(
        new URL(
          "../../packages/email/src/smtp-notification.ts",
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    environment: "node",
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
