// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { toUint8Array } from "js-base64";
import type { RoomHandle } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  PixelSyncServer,
  type ClientHandle
} from "#src/network/PixelSyncServer.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockClient extends ClientHandle {
  received: unknown[];
}

function createClient(id: string): MockClient {
  const received: unknown[] = [];

  return {
    id,
    received,
    send(data) {
      received.push(data);
    }
  };
}

function makeServer(
  size = { x: 4, y: 4 }
): PixelSyncServer {
  return new PixelSyncServer({
    buffer: new PixelBuffer({ size })
  });
}

/**
 * `receive()` no longer stashes a broadcast callback — the caller (normally
 * `ServerRoom`, via `onMessage`) hands one in per call. Tests that don't care
 * about broadcast delivery can pass this no-op.
 */
const noopRoom: RoomHandle = {
  broadcast: () => {
    // no observers
  }
};

/**
 * Connects a client and returns a RoomHandle that forwards broadcasts
 * straight to it — the single-client fake a unit test needs to observe
 * `receive()`'s broadcasts.
 */
function observe(
  server: PixelSyncServer,
  client: MockClient
): RoomHandle {
  server.onClientConnect(client);

  return { broadcast: (payload) => client.send(payload) };
}

function strokeCmd(
  opts: {
    clientId?: string;
    seq?: number;
    timestamp?: number;
    positions?: { x: number; y: number; }[];
    color?: { r: number; g: number; b: number; a: number; };
  } = {}
): PixelNetworkCommand {
  return {
    action: "stroke",
    metadata: {
      color: opts.color ?? { r: 1, g: 2, b: 3, a: 255 },
      positions: opts.positions ?? [{ x: 0, y: 0 }]
    },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
  };
}

function selectEditCmd(
  opts: {
    clientId?: string;
    seq?: number;
    timestamp?: number;
    positions?: { x: number; y: number; }[];
    colors?: { r: number; g: number; b: number; a: number; }[];
  } = {}
): PixelNetworkCommand {
  const positions = opts.positions ?? [{ x: 0, y: 0 }];

  return {
    action: "select-edit",
    metadata: {
      positions,
      colors: opts.colors ?? positions.map(() => {
        return { r: 1, g: 2, b: 3, a: 255 };
      })
    },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
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

// ---------------------------------------------------------------------------
// connect / disconnect
//
// Peer-joined/peer-left notifications are now a Server concern (see
// @jolly-pixel/network's Server.spec.ts) — PixelSyncServer no longer
// broadcasts them itself.
// ---------------------------------------------------------------------------

describe("PixelSyncServer — connect", () => {
  test("sends the buffer's current snapshot immediately on connect", () => {
    const server = makeServer();
    const client = createClient("A");
    server.onClientConnect(client);

    assert.strictEqual(client.received.length, 1);
    const msg = client.received[0] as {
      type: string;
      data: { size: unknown; };
    };
    assert.strictEqual(msg.type, "snapshot");
    assert.deepStrictEqual(msg.data.size, { x: 4, y: 4 });
  });
});

// Broadcast delivery to disconnected/left clients is now entirely a
// Server concern (see @jolly-pixel/network's Server.spec.ts,
// "broadcast stops reaching a client that left or disconnected") —
// PixelSyncServer no longer tracks its own client list.

// ---------------------------------------------------------------------------
// receive: stroke — per-pixel LWW conflict resolution
// ---------------------------------------------------------------------------

describe("PixelSyncServer — receive: stroke conflict resolution", () => {
  test("applies the command to the buffer", () => {
    const server = makeServer();

    server.receive(strokeCmd({
      positions: [
        { x: 2, y: 0 }
      ],
      color: { r: 7, g: 7, b: 7, a: 255 }
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.samplePixel(2, 0),
      [7, 7, 7, 255]
    );
  });

  test("accepts a later timestamp at the same pixel", () => {
    const server = makeServer();

    server.receive(strokeCmd({
      timestamp: 500,
      positions: [
        { x: 0, y: 0 }
      ],
      color: { r: 1, g: 1, b: 1, a: 255 },
      clientId: "A"
    }), noopRoom);
    server.receive(strokeCmd({
      timestamp: 900,
      positions: [
        { x: 0, y: 0 }
      ],
      color: { r: 2, g: 2, b: 2, a: 255 },
      clientId: "B"
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.samplePixel(0, 0),
      [2, 2, 2, 255]
    );
  });

  test("rejects a stale command at a pixel already written by a newer one", () => {
    const server = makeServer();

    server.receive(strokeCmd({
      timestamp: 900,
      positions: [
        { x: 0, y: 0 }
      ],
      color: { r: 2, g: 2, b: 2, a: 255 },
      clientId: "A"
    }), noopRoom);
    server.receive(strokeCmd({
      timestamp: 500,
      positions: [
        { x: 0, y: 0 }
      ],
      color: { r: 1, g: 1, b: 1, a: 255 },
      clientId: "B"
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.samplePixel(0, 0),
      [2, 2, 2, 255]
    );
  });

  test("splits a stroke: accepts pixels that don't conflict, rejects the one that does", () => {
    const server = makeServer();

    // (0,0) is claimed by a later command first.
    server.receive(strokeCmd({
      timestamp: 900,
      positions: [
        { x: 0, y: 0 }
      ],
      color: { r: 9, g: 9, b: 9, a: 255 },
      clientId: "A"
    }), noopRoom);

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    // A stale stroke touching both (0,0) [conflict] and (1,1) [no conflict].
    server.receive(strokeCmd({
      timestamp: 500,
      positions: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ],
      color: { r: 1, g: 1, b: 1, a: 255 },
      clientId: "B"
    }), room);

    // (0,0) keeps the winning color, (1,1) got the new stroke's color.
    assert.deepStrictEqual(
      server.buffer.samplePixel(0, 0),
      [9, 9, 9, 255]
    );
    assert.deepStrictEqual(
      server.buffer.samplePixel(1, 1),
      [1, 1, 1, 255]
    );

    // Broadcast carries only the accepted pixel.
    assert.strictEqual(client.received.length, 1);
    const msg = client.received[0] as {
      type: string;
      data: PixelNetworkCommand;
    };
    assert.strictEqual(msg.type, "command");
    assert.strictEqual(msg.data.action, "stroke");
    if (msg.data.action === "stroke") {
      assert.deepStrictEqual(
        msg.data.metadata.positions,
        [{ x: 1, y: 1 }]
      );
    }
  });

  test("drops a stroke entirely (no broadcast) when every pixel is rejected", () => {
    const server = makeServer();
    server.receive(strokeCmd({
      timestamp: 900,
      positions: [{ x: 0, y: 0 }],
      clientId: "A"
    }), noopRoom);

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    // Different client than the one that claimed (0,0): a same-client stale
    // timestamp would be trusted (see ConflictResolver's same-client
    // short-circuit), so this must come from someone else to be rejected.
    server.receive(strokeCmd({
      timestamp: 500,
      positions: [{ x: 0, y: 0 }],
      clientId: "B"
    }), room);

    assert.strictEqual(client.received.length, 0);
  });

  test("regression: undoing two overlapping same-client strokes newest-first fully reverts the shared pixel", () => {
    // Reproduces a chained-line undo: segment 1 (t=100) then segment 2
    // (t=200) both touch (0,0) — the joint pixel. Undo replays newest-first
    // (LIFO) and preserves each entry's *original* timestamp as
    // originTimestamp (see buffer/hooks.ts), so the replay of segment 2
    // (t=200) arrives before the replay of segment 1 (t=100) — an older
    // timestamp arriving after a newer one at the same pixel, from the same
    // client. Both must be accepted for the pixel to fully unwind.
    const server = makeServer();

    // Segment 1: (0,0) painted from background to color A.
    server.receive(strokeCmd({
      timestamp: 100,
      positions: [{ x: 0, y: 0 }],
      color: { r: 1, g: 1, b: 1, a: 255 },
      clientId: "A"
    }), noopRoom);
    // Segment 2: (0,0) repainted from color A to color B (the chained
    // line's joint pixel).
    server.receive(strokeCmd({
      timestamp: 200,
      positions: [{ x: 0, y: 0 }],
      color: { r: 2, g: 2, b: 2, a: 255 },
      clientId: "A"
    }), noopRoom);

    assert.deepStrictEqual(server.buffer.samplePixel(0, 0), [2, 2, 2, 255]);

    // Undo segment 2 first (LIFO): replay restores color A, stamped with
    // segment 2's own original timestamp (200).
    server.receive(strokeCmd({
      timestamp: 200,
      positions: [{ x: 0, y: 0 }],
      color: { r: 1, g: 1, b: 1, a: 255 },
      clientId: "A"
    }), noopRoom);
    assert.deepStrictEqual(server.buffer.samplePixel(0, 0), [1, 1, 1, 255]);

    // Undo segment 1 second: replay restores the background, stamped with
    // segment 1's own (older) original timestamp (100). Without the
    // same-client short-circuit this would be rejected as "stale" against
    // the (200)-stamped state the previous undo just wrote.
    server.receive(strokeCmd({
      timestamp: 100,
      positions: [{ x: 0, y: 0 }],
      color: { r: 0, g: 0, b: 0, a: 0 },
      clientId: "A"
    }), noopRoom);
    assert.deepStrictEqual(server.buffer.samplePixel(0, 0), [0, 0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// receive: select-edit — per-pixel LWW conflict resolution
// ---------------------------------------------------------------------------

describe("PixelSyncServer — receive: select-edit conflict resolution", () => {
  test("applies each position's own color to the buffer", () => {
    const server = makeServer();

    server.receive(selectEditCmd({
      positions: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      colors: [
        { r: 7, g: 7, b: 7, a: 255 },
        { r: 8, g: 8, b: 8, a: 255 }
      ]
    }), noopRoom);

    assert.deepStrictEqual(
      server.buffer.samplePixel(0, 0),
      [7, 7, 7, 255]
    );
    assert.deepStrictEqual(
      server.buffer.samplePixel(1, 0),
      [8, 8, 8, 255]
    );
  });

  test("splits a select-edit: accepts positions that don't conflict, rejects (and filters colors for) the one that does", () => {
    const server = makeServer();

    // (0,0) is claimed by a later command first.
    server.receive(strokeCmd({
      timestamp: 900,
      positions: [{ x: 0, y: 0 }],
      color: { r: 9, g: 9, b: 9, a: 255 },
      clientId: "A"
    }), noopRoom);

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    // A stale select-edit touching both (0,0) [conflict] and (1,1) [no conflict].
    server.receive(selectEditCmd({
      timestamp: 500,
      positions: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ],
      colors: [
        { r: 1, g: 1, b: 1, a: 255 },
        { r: 2, g: 2, b: 2, a: 255 }
      ],
      clientId: "B"
    }), room);

    // (0,0) keeps the stroke's winning color, (1,1) got the select-edit's color.
    assert.deepStrictEqual(
      server.buffer.samplePixel(0, 0),
      [9, 9, 9, 255]
    );
    assert.deepStrictEqual(
      server.buffer.samplePixel(1, 1),
      [2, 2, 2, 255]
    );

    // Broadcast carries only the accepted position/color pair, in lockstep.
    assert.strictEqual(client.received.length, 1);
    const msg = client.received[0] as {
      type: string;
      data: PixelNetworkCommand;
    };
    assert.strictEqual(msg.data.action, "select-edit");
    if (msg.data.action === "select-edit") {
      assert.deepStrictEqual(
        msg.data.metadata.positions,
        [{ x: 1, y: 1 }]
      );
      assert.deepStrictEqual(
        msg.data.metadata.colors,
        [{ r: 2, g: 2, b: 2, a: 255 }]
      );
    }
  });

  test("drops a select-edit entirely (no broadcast) when every position is rejected", () => {
    const server = makeServer();
    server.receive(strokeCmd({
      timestamp: 900,
      positions: [{ x: 0, y: 0 }],
      clientId: "A"
    }), noopRoom);

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    // Different client than the one that claimed (0,0): a same-client stale
    // timestamp would be trusted (see ConflictResolver's same-client
    // short-circuit), so this must come from someone else to be rejected.
    server.receive(selectEditCmd({
      timestamp: 500,
      positions: [{ x: 0, y: 0 }],
      clientId: "B"
    }), room);

    assert.strictEqual(client.received.length, 0);
  });
});

// ---------------------------------------------------------------------------
// receive: structural ops always accepted
// ---------------------------------------------------------------------------

describe("PixelSyncServer — receive: resized / texture-replaced", () => {
  test("resized is always accepted and broadcast", () => {
    const server = makeServer();

    server.receive({
      action: "resized",
      metadata: {
        size: { x: 8, y: 2 }
      },
      clientId: "A",
      seq: 2,
      timestamp: 1
    }, noopRoom);

    assert.deepStrictEqual(
      server.buffer.size(),
      { x: 8, y: 2 }
    );
  });

  test("texture-replaced is always accepted and broadcast", () => {
    const server = makeServer();

    const client = createClient("A");
    const room = observe(server, client);
    client.received.length = 0;

    server.receive({
      action: "texture-replaced",
      metadata: {
        size: { x: 2, y: 2 },
        pixels: ""
      },
      clientId: "B",
      seq: 2,
      timestamp: 1
    }, room);

    assert.strictEqual(client.received.length, 1);
  });
});

// ---------------------------------------------------------------------------
// snapshot()
// ---------------------------------------------------------------------------

describe("PixelSyncServer — snapshot", () => {
  test("returns decodable pixel data reflecting the buffer's current state", () => {
    const server = makeServer({ x: 2, y: 2 });
    server.receive(strokeCmd({
      positions: [{ x: 0, y: 0 }],
      color: { r: 5, g: 6, b: 7, a: 255 }
    }), noopRoom);

    const snap = server.snapshot();
    assert.deepStrictEqual(
      snap.size,
      { x: 2, y: 2 }
    );
    const pixels = toUint8Array(snap.pixels);
    assert.deepStrictEqual([
      pixels[0],
      pixels[1],
      pixels[2],
      pixels[3]
    ], [5, 6, 7, 255]);
  });

  test("includes the buffer's current UV regions, for late-joining clients", () => {
    const server = makeServer();
    server.receive(uvCreatedCmd({
      region: {
        id: "r1",
        rect: {
          x: 0,
          y: 0,
          width: 2,
          height: 2
        },
        color: "#f00"
      }
    }), noopRoom);

    const snap = server.snapshot();
    assert.deepStrictEqual(
      snap.uvRegions,
      [
        {
          id: "r1",
          rect: { x: 0, y: 0, width: 2, height: 2 },
          color: "#f00"
        }
      ]
    );
  });
});

describe("PixelSyncServer — custom buffer / id", () => {
  test("accepts an existing PixelBuffer in options", () => {
    const buffer = new PixelBuffer({ size: { x: 4, y: 4 } });

    const server = new PixelSyncServer({ buffer });
    assert.strictEqual(server.buffer, buffer);
  });

  test("defaults to the \"pixel-draw\" id, overridable per instance", () => {
    assert.strictEqual(new PixelSyncServer().id, "pixel-draw");
    assert.strictEqual(
      new PixelSyncServer({ id: "pixel-draw:tex1" }).id,
      "pixel-draw:tex1"
    );
  });
});
