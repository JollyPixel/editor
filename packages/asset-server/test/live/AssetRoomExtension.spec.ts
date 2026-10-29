// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { type RoomContext } from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";
import { Err, Ok } from "@openally/result";

// Import Internal Dependencies
import {
  AssetRoomExtension,
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
    append: async(input) => {
      appended.push(input);
      if (!appends) {
        const error = new Error("disk full");

        return Err(error);
      }

      return Ok({
        ...input,
        eventId: appended.length,
        eventVersion: appended.length,
        createdAt: ""
      });
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
    assert.deepEqual(extension.protocols.inbound!.events, [
      "increment",
      "subscribe-parts",
      "unsubscribe-parts"
    ]);
  });

  test("sends the protocol snapshot to a connecting client", async() => {
    const { extension, context } = harness();
    const peer = recordingClient("alice");

    await extension.onClientConnect(peer, roomPeer(peer.id), context);

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

  test("arbitrates a command only once the previous one is stored", async() => {
    const steps: string[] = [];
    const { extension, context } = harness({
      protocol: {
        arbitrate: (command) => {
          steps.push(`arbitrate ${command.seq}`);

          return {
            command,
            commit: (version) => steps.push(`commit ${version}`)
          };
        }
      }
    });

    await Promise.all([
      extension.onMessage("alice", { action: "increment", seq: 1 }, context),
      extension.onMessage("bob", { action: "increment", seq: 2 }, context)
    ]);

    assert.deepEqual(steps, [
      "arbitrate 1",
      "commit 1",
      "arbitrate 2",
      "commit 2"
    ]);
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
});
