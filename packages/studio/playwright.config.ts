// Import Third-party Dependencies
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL: "http://localhost:3004",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "pnpm run dev:e2e",
    port: 3004,
    reuseExistingServer: false,
    timeout: 60_000
  }
});
