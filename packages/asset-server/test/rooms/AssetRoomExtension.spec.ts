// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  MessageParser,
  protocolEvents,
  type ClientHandle,
  type RoomContext,
  type RoomPeer
} from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok
} from "@openally/result";

// Import Internal Dependencies
import { counterCommandProtocols } from "../helpers/protocols.ts";
import {
  AssetRoomExtension,
  ASSET_ROOM_DELETED,
  ASSET_ROOM_REJECTED,
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
  appended: EventStore.AppendInput[];
  broadcast: unknown[];
  direct: { clientId: string; payload: unknown; }[];
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
  const appended: EventStore.AppendInput[] = [];
  const broadcast: unknown[] = [];
  const direct: { clientId: string; payload: unknown; }[] = [];
  const committed: Command[] = [];
  const events: EventStore.EventWriter = {
    append: (input) => {
      appended.push(input);

      return appends ?
        Ok({
          ...input,
          eventId: appended.length,
          eventVersion: appended.length,
          createdAt: ""
        }) :
        Err(new Error("disk full"));
    }
  };

  const extension = new AssetRoomExtension<Command>(kBinding, {
    commandEventType: "counter.command",
    protocols: counterCommandProtocols,

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
  }, events);

  const context: RoomContext = {
    room: {
      broadcast: (payload) => broadcast.push(payload),
      sendTo: (clientId, payload) => direct.push({ clientId, payload })
    },
    identity: {
      subject: "alice-subject",
      role: "default"
    }
  };

  return {
    extension,
    context,
    appended,
    broadcast,
    direct,
    committed
  };
}

function roomPeer(
  clientId: string
): RoomPeer {
  return {
    clientId,
    identity: {
      subject: clientId,
      role: "default"
    },
    profile: {},
    presence: {}
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
    assert.deepEqual(protocolEvents(extension.protocols.inbound!), ["increment"]);
  });

  test("sends the protocol snapshot to a connecting client", () => {
    const { extension, context } = harness();
    const peer = client();

    extension.onClientConnect(peer, roomPeer(peer.id), context);

    assert.deepEqual(peer.received, [
      {
        type: "snapshot",
        data: { value: 7 }
      }
    ]);
  });

  test("resolves a declared action through the inbound protocol", () => {
    const { extension } = harness();
    const parser = new MessageParser(extension.protocols.inbound!);

    const parsed = parser.parse({ action: "increment" });
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.val.event, "increment");
  });

  test("rejects an undeclared or malformed payload", () => {
    const { extension } = harness();
    const parser = new MessageParser(extension.protocols.inbound!);

    assert.strictEqual(parser.parse({ action: "decrement" }).ok, false);
    assert.strictEqual(parser.parse({ type: "command" }).ok, false);
    assert.strictEqual(parser.parse(null).ok, false);
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
        },
        actor: {
          type: "user",
          id: "alice-subject"
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

  test("a rejected append sends the rejected notice to the author only", async() => {
    const { extension, context, direct } = harness({ appends: false });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(direct, [
      {
        clientId: "alice",
        payload: {
          type: ASSET_ROOM_REJECTED,
          reason: "disk full"
        }
      }
    ]);
  });

  test("a successful append sends no rejected notice", async() => {
    const { extension, context, direct } = harness();

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(direct, []);
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

describe("AssetRoomExtension — rejection", () => {
  test("adds the rejected notice to the outbound protocol", () => {
    const { extension } = harness();

    assert.ok(
      protocolEvents(extension.protocols.outbound!).includes(ASSET_ROOM_REJECTED)
    );
    const parser = new MessageParser(extension.protocols.outbound!);
    assert.strictEqual(
      parser.parse({ type: ASSET_ROOM_REJECTED, reason: "disk full" }).ok,
      true
    );
    assert.strictEqual(parser.parse({ type: ASSET_ROOM_REJECTED }).ok, false);
  });
});

describe("AssetRoomExtension — deletion", () => {
  test("adds the deleted notice to the outbound protocol", () => {
    const { extension } = harness();

    assert.ok(
      protocolEvents(extension.protocols.outbound!).includes(ASSET_ROOM_DELETED)
    );
    const parser = new MessageParser(extension.protocols.outbound!);
    assert.strictEqual(parser.parse({ type: ASSET_ROOM_DELETED }).ok, true);
  });

  test("broadcasts the deleted notice once to connected clients", () => {
    const { extension, context, broadcast } = harness();
    const peer = client();
    extension.onClientConnect(peer, roomPeer(peer.id), context);

    extension.markDeleted();
    extension.markDeleted();

    assert.strictEqual(extension.deleted, true);
    assert.deepEqual(broadcast, [{ type: ASSET_ROOM_DELETED }]);
  });

  test("sends the deleted notice instead of a snapshot to a late joiner", () => {
    const { extension, context } = harness();
    extension.markDeleted();
    const peer = client();

    extension.onClientConnect(peer, roomPeer(peer.id), context);

    assert.deepEqual(peer.received, [{ type: ASSET_ROOM_DELETED }]);
  });

  test("ignores commands once the asset is deleted", async() => {
    const { extension, context, appended, broadcast } = harness();
    extension.markDeleted();

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(appended, []);
    assert.deepEqual(broadcast, []);
  });
});
