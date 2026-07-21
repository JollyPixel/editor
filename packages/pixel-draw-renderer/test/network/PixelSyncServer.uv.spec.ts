// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PixelSyncServer,
  type ClientHandle
} from "#src/network/PixelSyncServer.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";

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

function bufferAddedCmd(
  bufferId: string,
  clientId = "client-A"
): PixelNetworkCommand {
  return {
    action: "buffer-added",
    bufferId,
    metadata: { size: { x: 4, y: 4 } },
    clientId,
    seq: 1,
    timestamp: 1000
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
    bufferId?: string;
    clientId?: string;
    seq?: number;
    timestamp?: number;
  }
): PixelNetworkCommand {
  return {
    action: "uv-region-created",
    bufferId: opts.bufferId ?? "tex1",
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
    bufferId?: string;
    clientId?: string;
    seq?: number;
    timestamp?: number;
  }
): PixelNetworkCommand {
  return {
    action: "uv-region-moved",
    bufferId: opts.bufferId ?? "tex1",
    metadata: { id: opts.id, rect: opts.rect },
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
    server.receive(bufferAddedCmd("tex1"));

    const client = createClient("A");
    server.connect(client);
    server.subscribe("A", "tex1");
    client.received.length = 0;

    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }));

    const buffer = server.world.getBuffer("tex1")!;
    assert.ok(buffer.uvRegions.get("r1"));
    assert.strictEqual(client.received.length, 1);
  });
});

describe("PixelSyncServer — receive: uv-region-moved / uv-region-deleted conflict resolution", () => {
  test("accepts a later-timestamp move over an earlier one for the same region", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }));

    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 500,
      clientId: "A"
    }));
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 2, y: 2, width: 2, height: 2 },
      timestamp: 900,
      clientId: "B"
    }));

    const buffer = server.world.getBuffer("tex1")!;
    assert.deepStrictEqual(
      buffer.uvRegions.get("r1")!.rect,
      { x: 2, y: 2, width: 2, height: 2 }
    );
  });

  test("rejects a stale move for a region already moved by a newer command", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }));

    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 2, y: 2, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }));
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 500,
      clientId: "B"
    }));

    const buffer = server.world.getBuffer("tex1")!;
    assert.deepStrictEqual(
      buffer.uvRegions.get("r1")!.rect,
      { x: 2, y: 2, width: 2, height: 2 }
    );
  });

  test("a stale delete does not remove a region moved by a newer command", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }));

    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 2, y: 2, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }));
    server.receive({
      action: "uv-region-deleted",
      bufferId: "tex1",
      metadata: { id: "r1" },
      clientId: "B",
      seq: 1,
      timestamp: 500
    });

    const buffer = server.world.getBuffer("tex1")!;
    assert.ok(
      buffer.uvRegions.get("r1"),
      "region should still exist — the delete was stale"
    );
  });

  test("a newer delete removes the region and later stale moves are rejected", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }));

    server.receive({
      action: "uv-region-deleted",
      bufferId: "tex1",
      metadata: { id: "r1" },
      clientId: "A",
      seq: 1,
      timestamp: 900
    });
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 500,
      clientId: "B"
    }));

    const buffer = server.world.getBuffer("tex1")!;

    assert.strictEqual(buffer.uvRegions.get("r1"), undefined);
  });

  test("moves/deletes on different regions of the same buffer never conflict", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }));
    server.receive(uvCreatedCmd({
      region: {
        id: "r2",
        rect: { x: 4, y: 4, width: 2, height: 2 },
        color: "#00f"
      },
      clientId: "B"
    }));

    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }));
    server.receive(uvMovedCmd({
      id: "r2",
      rect: { x: 5, y: 5, width: 2, height: 2 },
      timestamp: 100,
      clientId: "B"
    }));

    const buffer = server.world.getBuffer("tex1")!;

    assert.deepStrictEqual(
      buffer.uvRegions.get("r1")!.rect,
      { x: 1, y: 1, width: 2, height: 2 }
    );
    assert.deepStrictEqual(
      buffer.uvRegions.get("r2")!.rect,
      { x: 5, y: 5, width: 2, height: 2 }
    );
  });

  test("clears region conflict-tracking state when the buffer is removed", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      }
    }));
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 1, y: 1, width: 2, height: 2 },
      timestamp: 900,
      clientId: "A"
    }));

    server.receive({
      action: "buffer-removed",
      bufferId: "tex1",
      metadata: {},
      clientId: "A",
      seq: 1,
      timestamp: 1000
    });
    server.receive(bufferAddedCmd("tex1", "B"));

    // A stale-looking move (lower timestamp than the earlier session's 900)
    // is accepted because the buffer's history was cleared on removal.
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: { x: 0, y: 0, width: 2, height: 2 },
        color: "#f00"
      },
      clientId: "B"
    }));
    server.receive(uvMovedCmd({
      id: "r1",
      rect: { x: 3, y: 3, width: 2, height: 2 },
      timestamp: 1,
      clientId: "B"
    }));

    const buffer = server.world.getBuffer("tex1")!;

    assert.deepStrictEqual(
      buffer.uvRegions.get("r1")!.rect,
      { x: 3, y: 3, width: 2, height: 2 }
    );
  });

  test("commands targeting an unknown buffer are dropped", () => {
    const server = new PixelSyncServer();

    assert.doesNotThrow(() => {
      server.receive(uvMovedCmd({
        id: "r1",
        rect: { x: 0, y: 0, width: 1, height: 1 },
        bufferId: "no-such"
      }));
    });
  });
});
