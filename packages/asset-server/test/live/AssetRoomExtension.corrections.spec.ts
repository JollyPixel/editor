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
});
