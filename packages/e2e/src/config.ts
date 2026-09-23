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
const kDefaultWorkers = 4;
const kDefaultServerTimeout = 60_000;

export interface E2EConfigOptions {
  port: number;
  command: string;
  workers?: number;
  ciWorkers?: number;
  viewport?: ViewportSize;
  serverTimeout?: number;
  reuseExistingServer?: boolean;
}

export function defineE2EConfig(
  options: E2EConfigOptions
): PlaywrightTestConfig {
  const ci = Boolean(process.env.CI);
  const {
    port,
    command,
    workers = kDefaultWorkers,
    ciWorkers = workers,
    viewport,
    serverTimeout = kDefaultServerTimeout,
    reuseExistingServer = !ci
  } = options;

  return {
    testDir: "./test/e2e",
    testMatch: "**/*.e2e.ts",
    fullyParallel: true,
    workers: ci ? ciWorkers : workers,
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
      timeout: serverTimeout
    }
  };
}
