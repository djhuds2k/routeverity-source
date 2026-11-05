import { defineConfig } from "@playwright/test";
import { config } from "dotenv-flow";

config({ path: process.cwd(), silent: true });
const managedServer = process.env.ROUTEVERITY_E2E_START_SERVER === "1";
if (
  managedServer &&
  process.env.ROUTEVERITY_OPERATOR_EMAIL !== "operator-e2e@routeverity.test"
)
  throw new Error(
    "Managed acceptance requires the dedicated local operator profile.",
  );
export default defineConfig({
  testDir: "./tests/routeverity/e2e",
  timeout: 60_000,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: managedServer
    ? [
        ["list"],
        ["json", { outputFile: "test-results/routeverity-results.json" }],
      ]
    : "list",
  webServer: managedServer
    ? {
        command: "pnpm start:routeverity",
        url: "http://127.0.0.1:8888/login",
        reuseExistingServer: false,
        timeout: 30_000,
        stdout: "ignore",
        stderr: "pipe",
        gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
      }
    : undefined,
  use: {
    baseURL: "http://localhost:8888",
    browserName: "chromium",
    trace: "off",
  },
});
