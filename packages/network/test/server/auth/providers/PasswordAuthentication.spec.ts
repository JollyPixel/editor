// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PasswordAuthentication } from "#src/server/auth/providers/PasswordAuthentication.ts";
import { WEBSOCKET_AUTH_PROTOCOL_PREFIX } from "#src/transport/constants.ts";
import type { AuthenticationRequest } from "#src/server/auth/AuthenticationProvider.ts";

// CONSTANTS
const kProtocol = "jolly-pixel";

function base64url(
  value: string
): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function request(
  credential?: string
): AuthenticationRequest {
  const offered = credential === undefined ?
    kProtocol :
    `${kProtocol}, ${WEBSOCKET_AUTH_PROTOCOL_PREFIX}${base64url(credential)}`;

  return {
    clientId: "client-1",
    url: "/ws-sync",
    defaultRole: "viewer",
    headers: { "sec-websocket-protocol": offered }
  };
}

describe("PasswordAuthentication — optional password", () => {
  const auth = new PasswordAuthentication({
    password: "hunter2",
    role: "editor"
  });

  test("grants the configured role for a correct password", async() => {
    assert.deepEqual(await auth.authenticate(request("hunter2")), {
      subject: "client-1",
      role: "editor"
    });
  });

  test("falls through to the server default role when no credential is offered", async() => {
    assert.deepEqual(await auth.authenticate(request()), {
      subject: "client-1",
      role: "viewer"
    });
  });

  test("rejects a wrong password rather than falling through", async() => {
    assert.strictEqual(await auth.authenticate(request("wrong")), null);
  });

  test("rejects a password differing only in length", async() => {
    assert.strictEqual(await auth.authenticate(request("hunter22")), null);
    assert.strictEqual(await auth.authenticate(request("hunter")), null);
  });

  test("reads the credential from a header sent as an array", async() => {
    assert.deepEqual(
      await auth.authenticate({
        clientId: "client-1",
        url: "/ws-sync",
        defaultRole: "viewer",
        headers: {
          "sec-websocket-protocol": [
            kProtocol,
            `${WEBSOCKET_AUTH_PROTOCOL_PREFIX}${base64url("hunter2")}`
          ]
        }
      }),
      {
        subject: "client-1",
        role: "editor"
      }
    );
  });
});

describe("PasswordAuthentication — mandatory password", () => {
  const auth = new PasswordAuthentication({
    password: "hunter2",
    role: "editor",
    mandatory: true
  });

  test("rejects a client offering no credential", async() => {
    assert.strictEqual(await auth.authenticate(request()), null);
  });

  test("still grants the role for a correct password", async() => {
    assert.deepEqual(await auth.authenticate(request("hunter2")), {
      subject: "client-1",
      role: "editor"
    });
  });
});

describe("PasswordAuthentication — credential encoding", () => {
  const auth = new PasswordAuthentication({
    password: "pässwörd ✅",
    role: "editor"
  });

  test("round-trips a non-ascii password through base64url", async() => {
    assert.deepEqual(await auth.authenticate(request("pässwörd ✅")), {
      subject: "client-1",
      role: "editor"
    });
  });

  test("rejects a credential that is not valid base64url", async() => {
    assert.strictEqual(
      await auth.authenticate({
        clientId: "client-1",
        url: "/ws-sync",
        defaultRole: "viewer",
        headers: {
          "sec-websocket-protocol": `${WEBSOCKET_AUTH_PROTOCOL_PREFIX}!!!!`
        }
      }),
      null
    );
  });
});
