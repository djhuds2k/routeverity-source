import { defineConfig } from "@playwright/test";
import { config } from "dotenv-flow";

config({ path: process.cwd(), silent: true });
export default defineConfig({
  testDir: "./tests/routeverity/e2e",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8888",
    browserName: "chromium",
    trace: "off",
  },
});
