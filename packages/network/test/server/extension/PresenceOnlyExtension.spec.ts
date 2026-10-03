// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  NO_MESSAGE_PROTOCOLS,
  OPAQUE_PROTOCOLS,
  PresenceOnlyExtension,
  type RoomContext
} from "#src/index.ts";
import { actionProtocols } from "../../helpers/protocol/protocols.ts";

function createContext(): {
  context: RoomContext;
  broadcasts: unknown[];
} {
  const broadcasts: unknown[] = [];

  return {
    broadcasts,
    context: {
      room: {
        broadcast: (payload) => broadcasts.push(payload),
        sendTo: () => void 0
      },
      identity: {
        subject: "client-1",
        role: "default"
      }
    }
  };
}

describe("PresenceOnlyExtension", () => {
  test("uses the given id and a shared default name", () => {
    const extension = new PresenceOnlyExtension("three:peer-frustum-demo");

    assert.strictEqual(extension.id, "three:peer-frustum-demo");
    assert.strictEqual(extension.name, "presence-only");
  });

  test("accepts an explicit name override", () => {
    const extension = new PresenceOnlyExtension("room-a", "custom-name");

    assert.strictEqual(extension.name, "custom-name");
  });

  test("accepts no message and relays nothing by default", () => {
    const extension = new PresenceOnlyExtension("room-a");
    const { context, broadcasts } = createContext();

    extension.onMessage("client-1", { any: "payload" }, context);

    assert.strictEqual(extension.protocols, NO_MESSAGE_PROTOCOLS);
    assert.deepEqual(broadcasts, []);
  });

  test("relays opaque payloads to the room with broadcast enabled", () => {
    const extension = new PresenceOnlyExtension("room-a", undefined, {
      broadcast: true
    });
    const { context, broadcasts } = createContext();

    extension.onMessage("client-1", { any: "payload" }, context);

    assert.strictEqual(extension.protocols, OPAQUE_PROTOCOLS);
    assert.deepEqual(broadcasts, [{ any: "payload" }]);
  });

  test("keeps explicit protocols over the broadcast default", () => {
    const extension = new PresenceOnlyExtension("room-a", undefined, {
      broadcast: true,
      protocols: actionProtocols
    });

    assert.strictEqual(extension.protocols, actionProtocols);
  });
});
