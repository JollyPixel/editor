// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BypassAuthentication } from "#src/server/auth/providers/BypassAuthentication.ts";

describe("BypassAuthentication", () => {
  test("grants the server default role to every client", () => {
    assert.deepEqual(
      new BypassAuthentication().authenticate({
        clientId: "client-1",
        url: "/ws-sync",
        defaultRole: "viewer",
        headers: {}
      }),
      {
        subject: "client-1",
        role: "viewer"
      }
    );
  });

  test("ignores any credential the client offers", () => {
    assert.deepEqual(
      new BypassAuthentication().authenticate({
        clientId: "client-1",
        url: "/ws-sync?role=admin",
        defaultRole: "default",
        headers: {
          "sec-websocket-protocol": "jolly-pixel, jolly-pixel.auth.YWRtaW4"
        }
      }),
      {
        subject: "client-1",
        role: "default"
      }
    );
  });
});
