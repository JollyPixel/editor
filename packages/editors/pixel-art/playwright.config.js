// Import Node.js Dependencies
import process from "node:process";

// Import Third-party Dependencies
import { defineConfig } from "@playwright/test";

// Import Internal Dependencies
import {
  BASE_URL,
  PORT
} from "./test/e2e/constants.ts";

export default defineConfig({
  testDir: "./test/e2e",
  // Node's own "test" script globs "test/**/*.spec.ts" for node:test
  // these files use ".e2e.ts" instead so the two runners never pick up each other's files.
  testMatch: "**/*.e2e.ts",
  globalSetup: "./test/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
