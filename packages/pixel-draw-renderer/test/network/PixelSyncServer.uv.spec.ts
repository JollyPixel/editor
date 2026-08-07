// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RoomContext, RoomEventStoreHandle } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  PixelSyncServer,
  type ClientHandle
} from "#src/network/PixelSyncServer.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";
import { UVRegion, type UVFace, type UVRegionData } from "#src/uv/UVRegion.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockClient extends ClientHandle {
  received: unknown[];
}

function createClient(
  id: string
): MockClient {
  const received: unknown[] = [];

  return {
    id,
    received,
    send(data) {
      received.push(data);
    }
  };
}

// receive() never touches eventStore, so every RoomContext in this file shares one unused stub.
const unusedEventStore: RoomEventStoreHandle = {
  append: async() => true,
  list: () => Promise.resolve([])
};

/**
 * `receive()` no longer stashes a broadcast callback — the caller (normally
 * `ServerRoom`, via `onMessage`) hands one in per call. Tests that don't care
 * about broadcast delivery can pass this no-op.
 */
const noopRoom: RoomContext = {
  room: {
    broadcast: () => {
      // no observers
    },
    sendTo(): void {
      throw new Error("Function not implemented.");
    }
  },
  eventStore: unusedEventStore
};

/**
 * Connects a client and returns a RoomContext that forwards broadcasts
 * straight to it — the single-client fake a unit test needs to observe
 * `receive()`'s broadcasts.
 */
function observe(
  server: PixelSyncServer,
  client: MockClient
): RoomContext {
  server.onClientConnect(client);

  return {
    room: {
      broadcast: (payload) => client.send(payload),
      sendTo: () => {
        throw new Error("Function not implemented.");
      }
    },
    eventStore: unusedEventStore
  };
}

function uvCreatedCmd(
  opts: {
    region: {
      id: string;
      rect: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      color: string;
    };
    clientId?: string;
    seq?: number;
    timestamp?: number;
  }
): PixelNetworkCommand {
  return {
    action: "uv-region-created",
    metadata: { region: opts.region },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
  };
}

function uvMovedCmd(
  opts: {
    id: string;
    rect: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    face?: UVFace | null;
    clientId?: string;
    seq?: number;
    timestamp?: number;
  }
): PixelNetworkCommand {
  return {
    action: "uv-region-moved",
    metadata: { id: opts.id, face: opts.face ?? null, rect: opts.rect },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
  };
}

// ---------------------------------------------------------------------------
// receive: uv-region-* — per-region LWW conflict resolution
// ---------------------------------------------------------------------------

describe("PixelSyncServer — receive: uv-region-created", () => {
  test("applies unconditionally (idempotent by unique id) and broadcasts", () => {
    const server = new PixelSyncServer();

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }), room);

    assert.ok(server.buffer.uvRegions.get("r1"));
    assert.strictEqual(client.received.length, 1);
  });
});

describe("PixelSyncServer — receive: uv-region-moved / uv-region-deleted conflict resolution", () => {
  test("accepts a later-timestamp move over an earlier one for the same region", () => {
    const server = new PixelSyncServer();
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }), noopRoom);
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 500,
      clientId: "A"
    }), noopRoom);
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 2, y: 2, width: 2, height: 2 },
      timestamp: 900,
      clientId: "B"
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.uvRegions.get("r1")!.rectFor("front"),
      { x: 2, y: 2, width: 2, height: 2 }
    );
  });

  test("rejects a stale move for a region already moved by a newer command", () => {
    const server = new PixelSyncServer();
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }), noopRoom);
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 2, y: 2, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }), noopRoom);
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 500,
      clientId: "B"
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.uvRegions.get("r1")!.rectFor("front"),
      { x: 2, y: 2, width: 2, height: 2 }
    );
  });

  test("a stale delete does not remove a region moved by a newer command", () => {
    const server = new PixelSyncServer();
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }), noopRoom);
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 2, y: 2, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }), noopRoom);
    server.receive({
      action: "uv-region-deleted",
      metadata: { id: "r1" },
      clientId: "B",
      seq: 1,
      timestamp: 500
    }, noopRoom);

    assert.ok(
      server.buffer.uvRegions.get("r1"),
      "region should still exist — the delete was stale"
    );
  });

  test("a newer delete removes the region and later stale moves are rejected", () => {
    const server = new PixelSyncServer();
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }), noopRoom);
    server.receive({
      action: "uv-region-deleted",
      metadata: { id: "r1" },
      clientId: "A",
      seq: 1,
      timestamp: 900
    }, noopRoom);
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 500,
      clientId: "B"
    }), noopRoom);

    assert.strictEqual(server.buffer.uvRegions.get("r1"), undefined);
  });

  test("moves/deletes on different regions never conflict", () => {
    const server = new PixelSyncServer();
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }), noopRoom);
    server.receive(uvCreatedCmd({
      region: {
        id: "r2",
        rect: { x: 4, y: 4, width: 2, height: 2 },
        color: "#00f"
      },
      clientId: "B"
    }), noopRoom);
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }), noopRoom);
    server.receive(uvMovedCmd({
      id: "r2",
      rect: { x: 5, y: 5, width: 2, height: 2 },
      timestamp: 100,
      clientId: "B"
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.uvRegions.get("r1")!.rectFor("front"),
      { x: 1, y: 1, width: 2, height: 2 }
    );
    assert.deepStrictEqual(
      server.buffer.uvRegions.get("r2")!.rectFor("front"),
      { x: 5, y: 5, width: 2, height: 2 }
    );
  });
});

describe("PixelSyncServer — per-face conflict resolution", () => {
  function uvStateCmd(
    opts: {
      region: UVRegionData;
      clientId?: string;
      timestamp?: number;
    }
  ): PixelNetworkCommand {
    return {
      action: "uv-region-state-changed",
      metadata: { region: opts.region },
      clientId: opts.clientId ?? "client-A",
      seq: 1,
      timestamp: opts.timestamp ?? 1000
    };
  }

  function uncollapsed(
    id: string
  ): UVRegionData {
    return new UVRegion({
      id,
      color: "#f00",
      rect: { x: 0, y: 0, width: 2, height: 2 }
    }).uncollapse().toJSON();
  }

  test("two peers moving different faces of one region do not reject each other", () => {
    const server = new PixelSyncServer();
    server.receive(uvCreatedCmd({
      region: { id: "r1", rect: { x: 0, y: 0, width: 2, height: 2 }, color: "#f00" }
    }), noopRoom);
    server.receive(uvStateCmd({ region: uncollapsed("r1"), timestamp: 100 }), noopRoom);

    server.receive(uvMovedCmd({
      id: "r1",
      face: "top",
      rect: { x: 4, y: 4, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }), noopRoom);
    // Earlier timestamp, but a different face — no shared key, so no conflict.
    server.receive(uvMovedCmd({
      id: "r1",
      face: "bottom",
      rect: { x: 6, y: 6, width: 2, height: 2 },
      timestamp: 500,
      clientId: "B"
    }), noopRoom);

    const region = server.buffer.uvRegions.get("r1")!;
    assert.deepStrictEqual(region.rectFor("top"), { x: 4, y: 4, width: 2, height: 2 });
    assert.deepStrictEqual(
      region.rectFor("bottom"),
      { x: 6, y: 6, width: 2, height: 2 },
      "a disjoint face edit must not be dropped as stale"
    );
  });

  test("a stale move on the same face is still rejected", () => {
    const server = new PixelSyncServer();
    server.receive(uvCreatedCmd({
      region: { id: "r1", rect: { x: 0, y: 0, width: 2, height: 2 }, color: "#f00" }
    }), noopRoom);
    server.receive(uvStateCmd({ region: uncollapsed("r1"), timestamp: 100 }), noopRoom);

    server.receive(uvMovedCmd({
      id: "r1",
      face: "top",
      rect: { x: 4, y: 4, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }), noopRoom);
    server.receive(uvMovedCmd({
      id: "r1",
      face: "top",
      rect: { x: 8, y: 8, width: 2, height: 2 },
      timestamp: 500,
      clientId: "B"
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.uvRegions.get("r1")!.rectFor("top"),
      { x: 4, y: 4, width: 2, height: 2 }
    );
  });

  test("a state change rewrites the whole region, so a stale face move loses to it", () => {
    const server = new PixelSyncServer();
    server.receive(uvCreatedCmd({
      region: { id: "r1", rect: { x: 0, y: 0, width: 2, height: 2 }, color: "#f00" }
    }), noopRoom);
    server.receive(uvStateCmd({
      region: uncollapsed("r1"),
      timestamp: 900,
      clientId: "A"
    }), noopRoom);

    server.receive(uvMovedCmd({
      id: "r1",
      face: "left",
      rect: { x: 8, y: 8, width: 2, height: 2 },
      timestamp: 500,
      clientId: "B"
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.uvRegions.get("r1")!.rectFor("left"),
      { x: 0, y: 0, width: 2, height: 2 },
      "the collapse/uncollapse took every face key, so the older move is stale"
    );
  });

  test("a state change is applied and broadcast", () => {
    const server = new PixelSyncServer();
    const client = createClient("A");
    const room = observe(server, client);
    server.receive(uvCreatedCmd({
      region: { id: "r1", rect: { x: 0, y: 0, width: 2, height: 2 }, color: "#f00" }
    }), room);
    client.received.length = 0;

    server.receive(uvStateCmd({ region: uncollapsed("r1") }), room);

    assert.strictEqual(server.buffer.uvRegions.get("r1")!.state, "uncollapsed");
    assert.strictEqual(client.received.length, 1);
  });
});
