// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PresenceOnlyExtension,
  type ClientHandle,
  type RoomContext
} from "#src/index.ts";

const kClient: ClientHandle = {
  id: "client-1",
  send: () => void 0
};
const kContext: RoomContext = {
  room: {
    broadcast: () => void 0,
    sendTo: () => void 0
  },
  eventStore: {
    append: () => Promise.resolve(true),
    list: () => Promise.resolve([])
  }
};

describe("PresenceOnlyExtension", () => {
  test("uses the given id and a shared default name", () => {
    const extension = new PresenceOnlyExtension("three:peer-frustum-demo");

    assert.strictEqual(extension.id, "three:peer-frustum-demo");
    assert.strictEqual(extension.name, "presence-only");
  });

  test("shares the same default name across instances (single rights namespace)", () => {
    const first = new PresenceOnlyExtension("room-a");
    const second = new PresenceOnlyExtension("room-b");

    assert.strictEqual(first.name, second.name);
  });

  test("accepts an explicit name override", () => {
    const extension = new PresenceOnlyExtension("room-a", "custom-name");

    assert.strictEqual(extension.name, "custom-name");
  });

  test("lifecycle hooks are callable no-ops", () => {
    const extension = new PresenceOnlyExtension("room-a");

    assert.strictEqual(
      extension.onClientConnect(kClient, {}, kContext),
      undefined
    );
    assert.strictEqual(
      extension.onClientDisconnect(kClient.id, kContext),
      undefined
    );
    assert.strictEqual(
      extension.onMessage(kClient.id, { any: "payload" }, kContext),
      undefined
    );
  });
});
