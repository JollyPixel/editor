// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Third-party Dependencies
import type { ConfigEnv } from "vite";

// Import Internal Dependencies
import { RunMode } from "../../src/config/RunMode.ts";
import { CookieAuthentication } from "../../src/roles/CookieAuthentication.ts";

// CONSTANTS
const kPort = 3999;
const kSharedPlugins = [
  "jolly-pixel:prebundle-workspace",
  "jolly-pixel:precompress"
];

describe("RunMode", () => {
  const cases: {
    name: string;
    env: ConfigEnv;
    inMemory: boolean;
    server: object;
    cookieAuthentication: boolean;
  }[] = [
    {
      name: "dev keeps the project on disk and answers any host",
      env: {
        command: "serve",
        mode: "development"
      },
      inMemory: false,
      server: { allowedHosts: true },
      cookieAuthentication: false
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
      cookieAuthentication: true
    },
    {
      name: "a build never touches the project on disk",
      env: {
        command: "build",
        mode: "static"
      },
      inMemory: true,
      server: { allowedHosts: true },
      cookieAuthentication: false
    }
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      const mode = new RunMode(testCase.env, { port: kPort });

      assert.equal(mode.assetServer.inMemory, testCase.inMemory);
      assert.deepEqual(mode.server, testCase.server);
      assert.equal(
        mode.assetServer.auth instanceof CookieAuthentication,
        testCase.cookieAuthentication
      );
      assert.deepEqual(
        mode.plugins().map((plugin) => plugin.name),
        testCase.cookieAuthentication ?
          [...kSharedPlugins, "jolly-pixel:cookie-authentication"] :
          kSharedPlugins
      );
    });
  }
});
