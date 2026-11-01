// Import Node.js Dependencies
import process from "node:process";

// Import Third-party Dependencies
import type {
  PlaywrightTestConfig,
  ViewportSize
} from "@playwright/test";

// Import Internal Dependencies
import { baseUrl } from "./ports.ts";

// CONSTANTS
const kWorkers = 4;
const kServerTimeout = 60_000;
const kScenarioViewport = {
  width: 1280,
  height: 720
};

export interface E2EConfigOptions {
  port: number;
  command: string;
  ciWorkers?: number;
  localWorkers?: PlaywrightTestConfig["workers"];
  viewport?: ViewportSize;
  deviceScaleFactor?: number;
  reducedMotion?: "reduce" | "no-preference";
  reuseExistingServer?: boolean;
}

export function defineE2EConfig(
  options: E2EConfigOptions
): PlaywrightTestConfig {
  const ci = Boolean(process.env.CI);
  const {
    port,
    command,
    ciWorkers = kWorkers,
    localWorkers = kWorkers,
    viewport,
    deviceScaleFactor,
    reducedMotion,
    reuseExistingServer = !ci
  } = options;

  return {
    testDir: "./test/e2e",
    testMatch: "**/*.e2e.ts",
    fullyParallel: true,
    workers: ci ? ciWorkers : localWorkers,
    retries: ci ? 1 : 0,
    use: {
      baseURL: baseUrl(port),
      trace: ci ? "on-first-retry" : "off",
      ...(viewport === undefined ? {} : { viewport }),
      ...(deviceScaleFactor === undefined ? {} : { deviceScaleFactor }),
      ...(reducedMotion === undefined ? {} : { reducedMotion })
    },
    webServer: {
      command,
      port,
      reuseExistingServer,
      timeout: kServerTimeout
    }
  };
}

export interface ScenarioConfigOptions {
  port: number;
  command: string;
  viewport?: ViewportSize;
}

export function defineScenarioConfig(
  options: ScenarioConfigOptions
): PlaywrightTestConfig {
  const {
    port,
    command,
    viewport = kScenarioViewport
  } = options;
  const config = defineE2EConfig({
    port,
    command,
    localWorkers: 1,
    ciWorkers: 1,
    viewport
  });

  return {
    ...config,
    testDir: "./test/scenario",
    testMatch: "**/*.scenario.ts",
    fullyParallel: false,
    retries: 0,
    use: {
      ...config.use,
      channel: "chrome",
      headless: false,
      actionTimeout: 10_000,
      navigationTimeout: 30_000,
      trace: "retain-on-failure",
      video: {
        mode: "on",
        size: viewport
      }
    }
  };
}
