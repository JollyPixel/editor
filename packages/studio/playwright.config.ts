// Import Third-party Dependencies
import { defineConfig } from "@playwright/test";
import {
  PORTS,
  baseUrl,
  defineE2EConfig
} from "@jolly-pixel/e2e";

// CONSTANTS
const kProjectsSuite = "projects/**";
const kServerTimeout = 60_000;
const kStudio = defineE2EConfig({
  port: PORTS.studio,
  command: "pnpm run dev:e2e",
  reuseExistingServer: false,
  localWorkers: "50%"
});

export default defineConfig({
  ...kStudio,
  webServer: [
    kStudio.webServer ?? [],
    {
      command: "node test/e2e/projects/serve.ts",
      port: PORTS.studioProjects,
      reuseExistingServer: false,
      timeout: kServerTimeout
    }
  ].flat(),
  projects: [
    {
      name: "studio",
      testIgnore: kProjectsSuite
    },
    {
      name: "projects",
      testMatch: `${kProjectsSuite}/*.e2e.ts`,
      fullyParallel: false,
      use: {
        baseURL: baseUrl(PORTS.studioProjects)
      }
    }
  ]
});
