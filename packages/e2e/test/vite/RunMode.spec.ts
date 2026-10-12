// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Third-party Dependencies
import type { ConfigEnv } from "vite";

// Import Internal Dependencies
import { RunMode } from "../../src/vite/RunMode.ts";
import { CookieRoles } from "../../src/roles.ts";

// CONSTANTS
const kPort = 3999;

describe("RunMode", () => {
  const cases: {
    name: string;
    env: ConfigEnv;
    inMemory: boolean;
    server: object;
    cookieRoles: boolean;
  }[] = [
    {
      name: "dev keeps the workspace on disk and answers any host",
      env: {
        command: "serve",
        mode: "development"
      },
      inMemory: false,
      server: { allowedHosts: true },
      cookieRoles: false
    },
    {
      name: "e2e serves in memory on the suite port with cookie roles",
      env: {
        command: "serve",
        mode: "e2e"
      },
      inMemory: true,
      server: {
        port: kPort,
        strictPort: true
      },
      cookieRoles: true
    },
    {
      name: "a build never touches the workspace",
      env: {
        command: "build",
        mode: "static"
      },
      inMemory: true,
      server: { allowedHosts: true },
      cookieRoles: false
    }
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      const mode = new RunMode(testCase.env, { port: kPort });

      assert.equal(mode.inMemory, testCase.inMemory);
      assert.deepEqual(mode.server, testCase.server);
      assert.equal(
        mode.access.auth instanceof CookieRoles,
        testCase.cookieRoles
      );
      assert.equal(mode.plugins().length > 0, testCase.cookieRoles);
    });
  }
});
