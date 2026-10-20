// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { type RoomContext } from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";
import { Err, Ok } from "@openally/result";

// Import Internal Dependencies
import { AssetRoomExtension, type AssetLiveProtocol } from "#src/index.ts";
import { counterSnapshotSchema } from "../helpers/protocols.ts";
import {
  counterRoomBinding,
  counterRoomCommands,
  recordingRoom,
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

describe("AssetRoomExtension", () => {
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
