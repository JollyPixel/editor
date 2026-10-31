// Import Third-party Dependencies
import type { PlaywrightTestConfig } from "@playwright/test";
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

// CONSTANTS
const kViewport = {
  width: 1280,
  height: 720
};
const kE2E = defineE2EConfig({
  port: PORTS.voxelMap,
  command: "pnpm run dev:e2e",
  localWorkers: 1,
  ciWorkers: 1,
  viewport: kViewport
});

const config: PlaywrightTestConfig = {
  ...kE2E,
  testDir: "./test/scenario",
  testMatch: "**/*.scenario.ts",
  fullyParallel: false,
  retries: 0,
  use: {
    ...kE2E.use,
    channel: "chrome",
    headless: false,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    video: {
      mode: "on",
      size: kViewport
    }
  }
};

export default config;
