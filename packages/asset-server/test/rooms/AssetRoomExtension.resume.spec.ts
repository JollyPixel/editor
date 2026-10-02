// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ClientHandle,
  RoomContext,
  RoomPeer
} from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";
import { Ok } from "@openally/result";

// Import Internal Dependencies
import {
  counterCommandProtocol,
  counterSnapshotSchema
} from "../helpers/protocols.ts";
import {
  AssetRoomExtension,
  ASSET_UPDATED,
  type AssetCommands,
  type AssetRoomExtensionOptions
} from "#src/index.ts";

// CONSTANTS
const kAssetId = "asset-1";
const kEventType = "counter.command";

interface Command {
  action: string;
  clientId?: string;
  seq?: number;
}

function setup(
  options: AssetRoomExtensionOptions<Command> = {}
) {
  const log: EventStore.Event[] = [];
  function record(
    input: Omit<EventStore.AppendInput, "assetId" | "assetType">
  ): EventStore.Event {
    const event: EventStore.Event = {
      ...input,
      assetId: kAssetId,
      assetType: "counter",
      eventId: log.length + 1,
      eventVersion: log.length + 1,
      createdAt: ""
    };
    log.push(event);

    return event;
  }

  const commands: AssetCommands<unknown, Command> = {
    eventType: kEventType,
    protocol: counterCommandProtocol,
    apply: () => void 0
  };
  const extension = new AssetRoomExtension<Command>(
    {
      assetId: kAssetId,
      kind: "counter",
      roomId: `counter:${kAssetId}`,
      state: null,
      version: () => log.length
    },
    commands,
    {
      snapshotSchema: counterSnapshotSchema,
      snapshot: () => {
        return { value: log.length };
      },
      arbitrate: (command) => {
        return { command };
      }
    },
    {
      append: (input) => Ok(record(input))
    },
    {
      reader: {
        list: (_assetId, from = 0) => log.filter(
          (event) => event.eventVersion > from
        ),
        listFromCheckpoint: () => [],
        listAll: () => [],
        listFromCheckpoints: () => []
      },
      ...options
    }
  );
  const context: RoomContext = {
    room: {
      broadcast: () => void 0,
      sendTo: () => void 0
    },
    identity: {
      subject: "subject",
      role: "default"
    }
  };

  function connect(
    clientId: string,
    resume?: unknown
  ): { received: unknown[]; connected: Promise<void>; } {
    const received: unknown[] = [];
    const handle: ClientHandle = {
      id: clientId,
      send: (payload) => received.push(payload)
    };
    const peer: RoomPeer = {
      clientId,
      identity: context.identity,
      profile: {},
      presence: {},
      ...(resume === undefined ? {} : { resume })
    };

    return {
      received,
      connected: extension.onClientConnect(handle, peer, context)
    };
  }

  function send(
    clientId: string,
    seq: number
  ): void {
    extension.onMessage(clientId, { action: "increment", seq }, context);
  }

  return {
    extension,
    record,
    connect,
    send
  };
}

describe("AssetRoomExtension — resume", () => {
  test("answers with the commands after the resumed version and the previous ack", async() => {
    const { extension, connect, send } = setup();
    await connect("old").connected;
    send("old", 1);
    send("peer", 1);
    send("old", 2);
    extension.onClientDisconnect("old");

    const { received, connected } = connect("new", { clientId: "old", version: 1 });
    await connected;

    assert.deepEqual(received, [
      {
        type: "catch-up",
        data: [
          { action: "increment", seq: 1, clientId: "peer" },
          { action: "increment", seq: 2, clientId: "old" }
        ],
        version: 3,
        acks: { old: 2 }
      }
    ]);
  });

  test("skips renames and scheduled snapshots in the range", async() => {
    const { connect, record, send } = setup();
    send("peer", 1);
    record({
      eventType: "asset.renamed",
      eventData: {},
      actor: { type: "user", id: "a" }
    });
    record({
      eventType: ASSET_UPDATED,
      eventData: {},
      actor: { type: "system", source: "snapshot" }
    });

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    await connected;

    assert.deepEqual(received, [
      {
        type: "catch-up",
        data: [{ action: "increment", seq: 1, clientId: "peer" }],
        version: 3
      }
    ]);
  });

  test("falls back to a snapshot for a content change in the range", async() => {
    const { connect, record, send } = setup();
    send("peer", 1);
    record({
      eventType: ASSET_UPDATED,
      eventData: {},
      actor: { type: "user", id: "a" }
    });

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 2 }, version: 2 }
    ]);
  });

  test("falls back to a snapshot past the resume limit", async() => {
    const { connect, send } = setup({ resumeLimit: 2 });
    for (let seq = 1; seq <= 3; seq++) {
      send("peer", seq);
    }

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 3 }, version: 3 }
    ]);
  });

  test("falls back to a snapshot when compaction removed the range", async() => {
    const { connect, send } = setup();
    send("peer", 1);
    send("peer", 2);

    const { received, connected } = connect("new", { clientId: "old", version: 5 });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 2 }, version: 2 }
    ]);
  });

  test("answers a resume without a version with an acknowledging snapshot", async() => {
    const { extension, connect, send } = setup();
    await connect("old").connected;
    send("old", 4);
    extension.onClientDisconnect("old");

    const { received, connected } = connect("new", { clientId: "old" });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 1 }, version: 1, acks: { old: 4 } }
    ]);
  });

  test("waits for the previous connection to leave before answering", async() => {
    const { extension, connect, send } = setup();
    await connect("old").connected;

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    send("old", 1);
    assert.deepEqual(received, []);
    extension.onClientDisconnect("old");
    await connected;

    assert.deepEqual(received, [
      {
        type: "catch-up",
        data: [{ action: "increment", seq: 1, clientId: "old" }],
        version: 1,
        acks: { old: 1 }
      }
    ]);
  });

  test("stops waiting for the previous connection after the timeout", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { connect } = setup({ departureTimeout: 50 });
    await connect("old").connected;

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    t.mock.timers.tick(50);
    await connected;

    assert.deepEqual(received, [
      { type: "catch-up", data: [], version: 0 }
    ]);
  });

  test("a join without resume gets a snapshot with the room version", async() => {
    const { connect, send } = setup();
    send("peer", 1);

    const { received, connected } = connect("new");
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 1 }, version: 1 }
    ]);
  });
});

describe("AssetRoomExtension — restore", () => {
  test("hands the recorded commands to the protocol in order", () => {
    const restored: [unknown, number][] = [];

    new AssetRoomExtension<Command>(
      {
        assetId: kAssetId,
        kind: "counter",
        roomId: `counter:${kAssetId}`,
        state: null
      },
      {
        eventType: kEventType,
        protocol: counterCommandProtocol,
        apply: () => void 0
      },
      {
        snapshotSchema: counterSnapshotSchema,
        snapshot: () => null,
        arbitrate: () => null,
        restore: (command, version) => restored.push([command, version])
      },
      {
        append: () => {
          throw new Error("unexpected append");
        }
      },
      {
        restore: [
          {
            command: { action: "increment", clientId: "a", seq: 1 },
            version: 5
          },
          {
            command: { action: "increment", clientId: "b", seq: 1 },
            version: 7
          }
        ]
      }
    );

    assert.deepEqual(restored, [
      [{ action: "increment", clientId: "a", seq: 1 }, 5],
      [{ action: "increment", clientId: "b", seq: 1 }, 7]
    ]);
  });
});
