// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ClientHandle,
  RoomContext
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  AssetRoomExtension,
  UNKNOWN_ASSET_ACTION,
  type AssetLiveProtocol,
  type AssetRoomBinding
} from "#src/index.ts";

// CONSTANTS
const kBinding: AssetRoomBinding = {
  assetId: "asset-1",
  kind: "counter",
  roomId: "counter:asset-1",
  state: null
};

interface Command {
  action: string;
  by?: string;
}

interface Harness {
  extension: AssetRoomExtension<Command>;
  context: RoomContext;
  appended: unknown[];
  broadcast: unknown[];
  committed: Command[];
}

interface HarnessOptions {
  accepts?: boolean;
  appends?: boolean;
  protocol?: Partial<AssetLiveProtocol<Command>>;
}

function harness(
  options: HarnessOptions = {}
): Harness {
  const {
    accepts = true,
    appends = true,
    protocol = {}
  } = options;
  const appended: unknown[] = [];
  const broadcast: unknown[] = [];
  const committed: Command[] = [];

  const extension = new AssetRoomExtension<Command>(kBinding, {
    commandEventType: "counter.command",
    actions: ["increment"],

    parse(payload) {
      return typeof payload === "object" &&
        payload !== null &&
        "action" in payload &&
        payload.action === "increment" ?
        payload as Command :
        null;
    },

    snapshot() {
      return { value: 7 };
    },

    arbitrate(command, clientId) {
      if (!accepts) {
        return null;
      }

      const stamped: Command = {
        ...command,
        by: clientId
      };

      return {
        command: stamped,
        commit: () => committed.push(stamped)
      };
    },

    ...protocol
  });

  const context: RoomContext = {
    room: {
      broadcast: (payload) => broadcast.push(payload),
      sendTo: () => void 0
    },
    eventStore: {
      append: (input) => {
        appended.push(input);

        return Promise.resolve(appends);
      },
      list: () => Promise.resolve([])
    }
  };

  return {
    extension,
    context,
    appended,
    broadcast,
    committed
  };
}

function client(): ClientHandle & { received: unknown[]; } {
  const received: unknown[] = [];

  return {
    id: "alice",
    received,
    send: (payload) => received.push(payload)
  };
}

describe("AssetRoomExtension", () => {
  test("takes its id and name from the binding", () => {
    const { extension } = harness();

    assert.strictEqual(extension.id, "counter:asset-1");
    assert.strictEqual(extension.name, "counter");
    assert.deepEqual([...extension.events], ["increment"]);
  });

  test("sends the protocol snapshot to a connecting client", () => {
    const { extension } = harness();
    const peer = client();

    extension.onClientConnect(peer);

    assert.deepEqual(peer.received, [
      {
        type: "snapshot",
        data: { value: 7 }
      }
    ]);
  });

  test("names a declared action", () => {
    const { extension } = harness();

    assert.strictEqual(
      extension.getEventName({ action: "increment" }),
      "increment"
    );
  });

  test("names an undeclared or malformed payload", () => {
    const { extension } = harness();

    assert.strictEqual(
      extension.getEventName({ action: "decrement" }),
      UNKNOWN_ASSET_ACTION
    );
    assert.strictEqual(
      extension.getEventName({ type: "command" }),
      UNKNOWN_ASSET_ACTION
    );
    assert.strictEqual(
      extension.getEventName(null),
      UNKNOWN_ASSET_ACTION
    );
  });

  test("ignores a payload the protocol cannot parse", async() => {
    const { extension, context, appended, broadcast } = harness();

    await extension.onMessage("alice", { action: "decrement" }, context);

    assert.deepEqual(appended, []);
    assert.deepEqual(broadcast, []);
  });

  test("ignores a command the protocol rejects", async() => {
    const { extension, context, appended, broadcast } = harness({
      accepts: false
    });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(appended, []);
    assert.deepEqual(broadcast, []);
  });

  test("appends the arbitrated command under the asset identity", async() => {
    const { extension, context, appended } = harness();

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(appended, [
      {
        assetType: "counter",
        assetId: "asset-1",
        eventType: "counter.command",
        eventData: {
          action: "increment",
          by: "alice"
        }
      }
    ]);
  });

  test("broadcasts the arbitrated command once appended", async() => {
    const { extension, context, broadcast, committed } = harness();

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(broadcast, [
      {
        type: "command",
        data: {
          action: "increment",
          by: "alice"
        }
      }
    ]);
    assert.strictEqual(committed.length, 1);
  });

  test("a rejected append neither commits nor broadcasts", async() => {
    const {
      extension,
      context,
      appended,
      broadcast,
      committed
    } = harness({ appends: false });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.strictEqual(appended.length, 1);
    assert.deepEqual(broadcast, []);
    assert.deepEqual(committed, []);
  });

  test("uses the protocol broadcast when it defines one", async() => {
    const { extension, context, broadcast } = harness({
      protocol: {
        broadcast: () => {
          return {
            type: "snapshot",
            data: { value: 8 }
          };
        }
      }
    });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(broadcast, [
      {
        type: "snapshot",
        data: { value: 8 }
      }
    ]);
  });

  test("an arbitration without a commit still broadcasts", async() => {
    const { extension, context, broadcast } = harness({
      protocol: {
        arbitrate: (command) => {
          return { command };
        }
      }
    });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(broadcast, [
      {
        type: "command",
        data: { action: "increment" }
      }
    ]);
  });
});
