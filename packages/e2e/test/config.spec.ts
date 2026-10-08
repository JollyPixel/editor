// Import Node.js Dependencies
import assert from "node:assert/strict";
import process from "node:process";
import {
  afterEach,
  beforeEach,
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { defineE2EConfig } from "../src/config.ts";

// CONSTANTS
const kOptions = {
  port: 3100,
  command: "pnpm run dev:e2e"
};

describe("defineE2EConfig", () => {
  const ci = process.env.CI;

  beforeEach(() => {
    delete process.env.CI;
  });

  afterEach(() => {
    if (ci === undefined) {
      delete process.env.CI;
    }
    else {
      process.env.CI = ci;
    }
  });

  it("applies the shared defaults outside CI", () => {
    assert.deepEqual(defineE2EConfig(kOptions), {
      testDir: "./test/e2e",
      testMatch: "**/*.e2e.ts",
      fullyParallel: true,
      workers: 4,
      retries: 0,
      use: {
        baseURL: "http://localhost:3100",
        trace: "retain-on-failure"
      },
      webServer: {
        command: "pnpm run dev:e2e",
        port: 3100,
        reuseExistingServer: true,
        timeout: 60_000
      }
    });
  });

  it("retries once, uses ciWorkers and never reuses a server on CI", () => {
    process.env.CI = "true";
    const config = defineE2EConfig({
      ...kOptions,
      ciWorkers: 2,
      localWorkers: 8
    });

    assert.equal(config.workers, 2);
    assert.equal(config.retries, 1);
    assert.equal(config.use?.trace, "on-first-retry");
    assert.deepEqual(config.webServer, {
      command: "pnpm run dev:e2e",
      port: 3100,
      reuseExistingServer: false,
      timeout: 60_000
    });
  });

  it("keeps the default workers on CI without ciWorkers", () => {
    process.env.CI = "true";

    assert.equal(defineE2EConfig(kOptions).workers, 4);
  });

  it("uses localWorkers outside CI", () => {
    const config = defineE2EConfig({
      ...kOptions,
      ciWorkers: 2,
      localWorkers: "50%"
    });

    assert.equal(config.workers, "50%");
  });

  it("applies viewport, motion and reuse overrides", () => {
    const config = defineE2EConfig({
      ...kOptions,
      viewport: {
        width: 960,
        height: 540
      },
      reducedMotion: "reduce",
      reuseExistingServer: false
    });

    assert.deepEqual(config.use, {
      baseURL: "http://localhost:3100",
      trace: "retain-on-failure",
      viewport: {
        width: 960,
        height: 540
      },
      reducedMotion: "reduce"
    });
    assert.deepEqual(config.webServer, {
      command: "pnpm run dev:e2e",
      port: 3100,
      reuseExistingServer: false,
      timeout: 60_000
    });
  });
});
