// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  MessageParser,
  type RoomContext
} from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok
} from "@openally/result";

// Import Internal Dependencies
import {
  AssetRoomExtension,
  ASSET_ROOM_DELETED,
  ASSET_ROOM_REJECTED,
  type AssetLiveProtocol
} from "#src/index.ts";
import { counterSnapshotSchema } from "../helpers/protocols.ts";
import {
  counterRoomBinding,
  counterRoomCommands,
  recordingClient,
  recordingRoom,
  roomPeer,
  type DirectMessage
} from "../helpers/rooms.ts";

interface Command {
  action: string;
  clientId?: string;
  seq?: number;
  timestamp?: number;
}

interface Harness {
  extension: AssetRoomExtension<Command>;
  context: RoomContext;
  appended: EventStore.AppendInput[];
  broadcast: unknown[];
  direct: DirectMessage[];
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
  const room = recordingRoom();
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

  const extension = new AssetRoomExtension<Command>(
    counterRoomBinding(),
    counterRoomCommands<Command>(),
    {
      snapshotSchema: counterSnapshotSchema,

      snapshot() {
        return { value: 7 };
      },

      arbitrate(command) {
        if (!accepts) {
          return null;
        }

        return {
          command,
          commit: () => committed.push(command)
        };
      },

      ...protocol
    },
    events
  );

  return {
    extension,
    context: room.context,
    appended,
    broadcast: room.broadcasts,
    direct: room.direct,
    committed
  };
}

describe("AssetRoomExtension", () => {
  test("takes its id and name from the binding", () => {
    const { extension } = harness();

    assert.strictEqual(extension.id, "counter:asset-1");
    assert.strictEqual(extension.name, "counter");
    assert.deepEqual(extension.protocols.inbound!.events, ["increment"]);
  });

  test("sends the protocol snapshot to a connecting client", () => {
    const { extension, context } = harness();
    const peer = recordingClient("alice");

    extension.onClientConnect(peer, roomPeer(peer.id), context);

    assert.deepEqual(peer.received, [
      {
        type: "snapshot",
        data: { value: 7 }
      }
    ]);
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
          clientId: "alice"
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
          clientId: "alice"
        },
        version: 1
      }
    ]);
    assert.strictEqual(committed.length, 1);
  });

  test("commits the admission with the version of its event", async() => {
    const versions: (number | undefined)[] = [];
    const { extension, context } = harness({
      protocol: {
        arbitrate: (command) => {
          return {
            command,
            commit: (version) => versions.push(version)
          };
        }
      }
    });

    await extension.onMessage("alice", { action: "increment" }, context);
    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(versions, [1, 2]);
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

  test("a rejected append sends the rejected notice then a snapshot to the author only", async() => {
    const { extension, context, direct } = harness({ appends: false });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(direct, [
      {
        clientId: "alice",
        payload: {
          type: ASSET_ROOM_REJECTED,
          reason: "disk full"
        }
      },
      {
        clientId: "alice",
        payload: {
          type: "snapshot",
          data: { value: 7 }
        }
      }
    ]);
  });

  test("resyncs the author alone when arbitration refuses a command", async() => {
    const { extension, context, direct } = harness({ accepts: false });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(direct, [
      {
        clientId: "alice",
        payload: {
          type: "snapshot",
          data: { value: 7 }
        }
      }
    ]);
  });

  test("resyncs the author after broadcasting a narrowed command", async() => {
    const { extension, context, broadcast, direct } = harness({
      protocol: {
        arbitrate: (command) => {
          return {
            command: {
              ...command
            }
          };
        }
      }
    });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.strictEqual(broadcast.length, 1);
    assert.deepEqual(direct, [
      {
        clientId: "alice",
        payload: {
          type: "snapshot",
          data: { value: 7 }
        }
      }
    ]);
  });

  test("sends the author a correction of a refused command instead of a snapshot", async() => {
    const corrections: [Command, Command | null][] = [];
    const { extension, context, direct } = harness({
      accepts: false,
      protocol: {
        correct: (command, admitted) => {
          corrections.push([command, admitted]);

          return command;
        }
      }
    });

    await extension.onMessage("alice", { action: "increment" }, context);

    const sent = { action: "increment", clientId: "alice" };
    assert.deepEqual(corrections, [[sent, null]]);
    assert.deepEqual(direct, [
      {
        clientId: "alice",
        payload: {
          type: "correction",
          data: sent
        }
      }
    ]);
  });

  test("hands the correction the narrowed command it broadcast", async() => {
    const narrowed = {
      action: "increment",
      clientId: "alice"
    } as const;
    const corrections: [Command, Command | null][] = [];
    const { extension, context, direct } = harness({
      protocol: {
        arbitrate: () => {
          return { command: narrowed };
        },
        correct: (command, admitted) => {
          corrections.push([command, admitted]);

          return command;
        }
      }
    });

    await extension.onMessage("alice", { action: "increment", seq: 4 }, context);

    assert.strictEqual(corrections[0][1], narrowed);
    assert.deepEqual(direct.map(({ payload }) => payload), [{
      type: "correction",
      data: { action: "increment", seq: 4, clientId: "alice" },
      acks: { alice: 4 }
    }], "a narrowed command was admitted, so no refused seq");
  });

  test("falls back to a snapshot when the protocol has no correction", async() => {
    const { extension, context, direct } = harness({
      accepts: false,
      protocol: {
        correct: () => null
      }
    });

    await extension.onMessage("alice", { action: "increment" }, context);

    assert.deepEqual(direct, [
      {
        clientId: "alice",
        payload: {
          type: "snapshot",
          data: { value: 7 }
        }
      }
    ]);
  });

  test("clamps a timestamp ahead of the server clock", async(t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 5_000 });
    const { extension, context, appended } = harness();

    await extension.onMessage("alice", {
      action: "increment",
      timestamp: 9_000
    }, context);
    await extension.onMessage("alice", {
      action: "increment",
      timestamp: 1_000
    }, context);

    assert.deepEqual(
      appended.map(({ eventData }) => eventData),
      [
        { action: "increment", clientId: "alice", timestamp: 5_000 },
        { action: "increment", clientId: "alice", timestamp: 1_000 }
      ]
    );
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
        data: { value: 8 },
        version: 1
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
        data: {
          action: "increment",
          clientId: "alice"
        },
        version: 1
      }
    ]);
  });

  test("overwrites a client-supplied clientId with the sender id", async() => {
    const { extension, context, appended } = harness();

    await extension.onMessage("alice", {
      action: "increment",
      clientId: "bob"
    }, context);

    assert.deepEqual(appended[0].eventData, {
      action: "increment",
      clientId: "alice"
    });
  });
});

describe("AssetRoomExtension — acks", () => {
  test("a correction acknowledges the author's last processed seq", async() => {
    const { extension, context, direct } = harness({
      accepts: false,
      protocol: {
        correct: (command) => command
      }
    });

    await extension.onMessage("alice", { action: "increment", seq: 4 }, context);

    assert.deepEqual(direct[0].payload, {
      type: "correction",
      data: {
        action: "increment",
        seq: 4,
        clientId: "alice"
      },
      acks: { alice: 4 },
      refused: 4
    });
  });

  test("a resync snapshot acknowledges the author only", async() => {
    const { extension, context, direct } = harness({ accepts: false });

    await extension.onMessage("bob", { action: "increment", seq: 9 }, context);
    await extension.onMessage("alice", { action: "increment", seq: 2 }, context);

    assert.deepEqual(direct.at(-1), {
      clientId: "alice",
      payload: {
        type: "snapshot",
        data: { value: 7 },
        acks: { alice: 2 },
        refused: 2
      }
    });
  });

  test("a broadcast snapshot acknowledges every member", async() => {
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

    await extension.onMessage("bob", { action: "increment", seq: 3 }, context);
    await extension.onMessage("alice", { action: "increment", seq: 5 }, context);

    assert.deepEqual(broadcast.at(-1), {
      type: "snapshot",
      data: { value: 8 },
      version: 2,
      acks: { bob: 3, alice: 5 }
    });
  });

  test("a reload snapshot acknowledges every member", async() => {
    const { extension, context, broadcast } = harness();
    const peer = recordingClient("alice");
    await extension.onClientConnect(peer, roomPeer(peer.id), context);

    await extension.onMessage("bob", { action: "increment", seq: 3 }, context);
    await extension.onMessage("alice", { action: "increment", seq: 5 }, context);
    extension.reload();

    assert.deepEqual(broadcast.at(-1), {
      type: "snapshot",
      data: { value: 7 },
      acks: { bob: 3, alice: 5 }
    });
  });

  test("forgets a client's processed seq when it disconnects", async() => {
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

    await extension.onMessage("bob", { action: "increment", seq: 3 }, context);
    extension.onClientDisconnect("bob");
    await extension.onMessage("alice", { action: "increment", seq: 5 }, context);

    assert.deepEqual(broadcast.at(-1), {
      type: "snapshot",
      data: { value: 8 },
      version: 2,
      acks: { alice: 5 }
    });
  });

  test("answers a resync with a snapshot acknowledging the client", async() => {
    const { extension, context, direct } = harness();

    await extension.onMessage("alice", { action: "increment", seq: 6 }, context);
    extension.onResync("alice", context);

    assert.deepEqual(direct, [
      {
        clientId: "alice",
        payload: {
          type: "snapshot",
          data: { value: 7 },
          acks: { alice: 6 }
        }
      }
    ]);
  });
});

describe("AssetRoomExtension — rejection", () => {
  test("adds the rejected notice to the outbound protocol", () => {
    const { extension } = harness();

    assert.ok(
      extension.protocols.outbound!.events.includes(ASSET_ROOM_REJECTED)
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
      extension.protocols.outbound!.events.includes(ASSET_ROOM_DELETED)
    );
    const parser = new MessageParser(extension.protocols.outbound!);
    assert.strictEqual(parser.parse({ type: ASSET_ROOM_DELETED }).ok, true);
  });

  test("broadcasts the deleted notice once to connected clients", () => {
    const { extension, context, broadcast } = harness();
    const peer = recordingClient("alice");
    extension.onClientConnect(peer, roomPeer(peer.id), context);

    extension.markDeleted();
    extension.markDeleted();

    assert.strictEqual(extension.deleted, true);
    assert.deepEqual(broadcast, [{ type: ASSET_ROOM_DELETED }]);
  });

  test("sends the deleted notice instead of a snapshot to a late joiner", () => {
    const { extension, context } = harness();
    extension.markDeleted();
    const peer = recordingClient("alice");

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
