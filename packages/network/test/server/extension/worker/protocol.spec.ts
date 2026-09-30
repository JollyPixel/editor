// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { isMainToWorkerMessage } from "#src/server/extension/worker/protocol.ts";

function connectDispatch(
  peer: unknown
) {
  return {
    type: "dispatch",
    id: "call-1",
    method: "onClientConnect",
    identity: {
      subject: "alice",
      role: "default"
    },
    args: ["A", peer]
  };
}

describe("isMainToWorkerMessage", () => {
  test("accepts an onClientConnect dispatch carrying a room peer", () => {
    const message = connectDispatch({
      clientId: "A",
      identity: {
        subject: "alice",
        role: "default"
      },
      profile: {},
      presence: {}
    });

    assert.strictEqual(isMainToWorkerMessage(message), true);
  });

  test("accepts a room peer carrying a resume payload", () => {
    const message = connectDispatch({
      clientId: "A",
      identity: {
        subject: "alice",
        role: "default"
      },
      profile: {},
      presence: {},
      resume: { version: 3 }
    });

    assert.strictEqual(isMainToWorkerMessage(message), true);
  });

  test("accepts an onResync dispatch", () => {
    assert.strictEqual(isMainToWorkerMessage({
      type: "dispatch",
      id: "call-1",
      method: "onResync",
      identity: {
        subject: "alice",
        role: "default"
      },
      args: ["A"]
    }), true);
  });

  test("rejects an onClientConnect dispatch whose peer is incomplete", () => {
    assert.strictEqual(isMainToWorkerMessage(connectDispatch({})), false);
    assert.strictEqual(isMainToWorkerMessage(connectDispatch({
      clientId: "A",
      profile: {},
      presence: {}
    })), false);
  });
});
