// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser, type RoomContext } from "@jolly-pixel/network";
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
    append: (input) => {
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
