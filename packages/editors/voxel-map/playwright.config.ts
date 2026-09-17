// Import Node.js Dependencies
import process from "node:process";

// Import Third-party Dependencies
import { defineConfig } from "@playwright/test";

// Import Internal Dependencies
import {
  BASE_URL,
  CI_WORKER_COUNT,
  E2E_PORT,
  WORKER_COUNT
} from "./test/e2e/constants.ts";

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  workers: process.env.CI ? CI_WORKER_COUNT : WORKER_COUNT,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    viewport: {
      width: 960,
      height: 540
    },
    trace: "retain-on-failure"
  },
  webServer: {
    command: "pnpm run dev:e2e",
    port: E2E_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
