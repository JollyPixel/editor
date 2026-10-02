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

export interface E2EConfigOptions {
  port: number;
  command: string;
  ciWorkers?: number;
  viewport?: ViewportSize;
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
    viewport,
    reuseExistingServer = !ci
  } = options;

  return {
    testDir: "./test/e2e",
    testMatch: "**/*.e2e.ts",
    fullyParallel: true,
    workers: ci ? ciWorkers : kWorkers,
    retries: ci ? 1 : 0,
    use: {
      baseURL: baseUrl(port),
      trace: "retain-on-failure",
      ...(viewport === undefined ? {} : { viewport })
    },
    webServer: {
      command,
      port,
      reuseExistingServer,
      timeout: kServerTimeout
    }
  };
}
