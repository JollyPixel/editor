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
  ASSET_ROOM_DELETED,
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

describe("AssetRoomExtension — deletion", () => {
  test("adds the deleted notice to the outbound protocol", () => {
    const { extension } = harness();

    assert.ok(
      extension.protocols.outbound!.events.includes(ASSET_ROOM_DELETED)
    );
    const parser = new MessageParser(extension.protocols.outbound!);
    assert.strictEqual(parser.parse({ type: ASSET_ROOM_DELETED }).ok, true);
  });

  test("broadcasts the deleted notice once to connected clients", async() => {
    const { extension, context, broadcast } = harness();
    const peer = recordingClient("alice");
    await extension.onClientConnect(peer, roomPeer(peer.id), context);

    extension.markDeleted();
    extension.markDeleted();

    assert.strictEqual(extension.deleted, true);
    assert.deepEqual(broadcast, [{ type: ASSET_ROOM_DELETED }]);
  });

  test("sends the deleted notice instead of a snapshot to a late joiner", async() => {
    const { extension, context } = harness();
    extension.markDeleted();
    const peer = recordingClient("alice");

    await extension.onClientConnect(peer, roomPeer(peer.id), context);

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
