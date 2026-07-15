// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { toUint8Array } from "js-base64";

// Import Internal Dependencies
import {
  PixelSyncServer,
  type ClientHandle
} from "../../src/network/PixelSyncServer.ts";
import { PixelWorld } from "../../src/network/PixelWorld.ts";
import type { PixelNetworkCommand } from "../../src/network/types.ts";

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

function strokeCmd(
  opts: {
    clientId?: string;
    seq?: number;
    timestamp?: number;
    bufferId?: string;
    positions?: { x: number; y: number; }[];
    color?: { r: number; g: number; b: number; a: number; };
  } = {}
): PixelNetworkCommand {
  return {
    action: "stroke",
    bufferId: opts.bufferId ?? "tex1",
    metadata: {
      color: opts.color ?? { r: 1, g: 2, b: 3, a: 255 },
      positions: opts.positions ?? [{ x: 0, y: 0 }]
    },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
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

// ---------------------------------------------------------------------------
// connect / disconnect (presence only)
// ---------------------------------------------------------------------------

describe("PixelSyncServer — connect", () => {
  it("sends no buffer data on connect", () => {
    const server = new PixelSyncServer();
    const client = createClient("A");
    server.connect(client);
    assert.strictEqual(client.received.length, 0);
  });

  it("notifies existing peers when a new client joins", () => {
    const server = new PixelSyncServer();
    const clientA = createClient("A");
    const clientB = createClient("B");

    server.connect(clientA);
    server.connect(clientB);

    assert.strictEqual(clientA.received.length, 1);
    const notification = clientA.received[0] as { type: string; peerId: string; };
    assert.strictEqual(notification.type, "peer-joined");
    assert.strictEqual(notification.peerId, "B");
  });
});

describe("PixelSyncServer — disconnect", () => {
  it("notifies remaining peers when a client leaves", () => {
    const server = new PixelSyncServer();
    const clientA = createClient("A");
    const clientB = createClient("B");
    server.connect(clientA);
    server.connect(clientB);
    clientA.received.length = 0;

    server.disconnect("B");

    assert.strictEqual(clientA.received.length, 1);
    const msg = clientA.received[0] as { type: string; peerId: string; };
    assert.strictEqual(msg.type, "peer-left");
    assert.strictEqual(msg.peerId, "B");
  });

  it("stops broadcasting to a disconnected client's subscriptions", () => {
    const server = new PixelSyncServer();
    server.world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    const clientA = createClient("A");
    server.connect(clientA);
    server.subscribe("A", "tex1");
    server.disconnect("A");
    clientA.received.length = 0;

    server.receive(strokeCmd({ clientId: "other" }));

    assert.strictEqual(clientA.received.length, 0);
  });
});

// ---------------------------------------------------------------------------
// subscribe / unsubscribe
// ---------------------------------------------------------------------------

describe("PixelSyncServer — subscribe", () => {
  it("sends the buffer's current snapshot to the subscriber", () => {
    const server = new PixelSyncServer();
    server.world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    const client = createClient("A");
    server.connect(client);

    server.subscribe("A", "tex1");

    assert.strictEqual(client.received.length, 1);
    const msg = client.received[0] as { type: string; bufferId: string; data: { size: unknown; pixels: string; }; };
    assert.strictEqual(msg.type, "snapshot");
    assert.strictEqual(msg.bufferId, "tex1");
    assert.deepStrictEqual(msg.data.size, { x: 4, y: 4 });
  });

  it("sends nothing when the buffer does not exist yet", () => {
    const server = new PixelSyncServer();
    const client = createClient("A");
    server.connect(client);

    server.subscribe("A", "no-such");

    assert.strictEqual(client.received.length, 0);
  });

  it("only broadcasts to subscribers of that buffer", () => {
    const server = new PixelSyncServer();
    server.world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    server.world.addBuffer("tex2", { size: { x: 4, y: 4 } });

    const clientA = createClient("A");
    const clientB = createClient("B");
    server.connect(clientA);
    server.connect(clientB);
    server.subscribe("A", "tex1");
    server.subscribe("B", "tex2");
    clientA.received.length = 0;
    clientB.received.length = 0;

    server.receive(strokeCmd({ bufferId: "tex1", clientId: "X" }));

    assert.strictEqual(clientA.received.length, 1);
    assert.strictEqual(clientB.received.length, 0);
  });

  it("unsubscribe stops future broadcasts for that buffer", () => {
    const server = new PixelSyncServer();
    server.world.addBuffer("tex1", { size: { x: 4, y: 4 } });
    const client = createClient("A");
    server.connect(client);
    server.subscribe("A", "tex1");
    server.unsubscribe("A", "tex1");
    client.received.length = 0;

    server.receive(strokeCmd({ clientId: "other" }));

    assert.strictEqual(client.received.length, 0);
  });
});

// ---------------------------------------------------------------------------
// receive: buffer lifecycle
// ---------------------------------------------------------------------------

describe("PixelSyncServer — receive: buffer-added", () => {
  it("creates the buffer and broadcasts to subscribers", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    assert.ok(server.world.hasBuffer("tex1"));
  });

  it("is a no-op if the buffer already exists (no duplicate broadcast)", () => {
    const server = new PixelSyncServer();
    const client = createClient("A");
    server.connect(client);
    server.receive(bufferAddedCmd("tex1"));
    server.subscribe("A", "tex1");
    client.received.length = 0;

    server.receive(bufferAddedCmd("tex1"));

    assert.strictEqual(client.received.length, 0);
  });
});

describe("PixelSyncServer — receive: buffer-removed", () => {
  it("removes the buffer and clears its conflict-tracking state", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    server.receive(strokeCmd({ timestamp: 500 }));

    server.receive({
      action: "buffer-removed",
      bufferId: "tex1",
      metadata: {},
      clientId: "A",
      seq: 2,
      timestamp: 900
    });

    assert.strictEqual(server.world.hasBuffer("tex1"), false);

    // Re-creating the buffer and replaying an old-timestamp stroke should be
    // accepted again — proves the per-pixel history was cleared.
    server.receive(bufferAddedCmd("tex1"));
    server.receive(strokeCmd({ timestamp: 100, color: { r: 9, g: 9, b: 9, a: 255 } }));
    const buffer = server.world.getBuffer("tex1")!;
    assert.deepStrictEqual(buffer.samplePixel(0, 0), [9, 9, 9, 255]);
  });
});

// ---------------------------------------------------------------------------
// receive: stroke — per-pixel LWW conflict resolution
// ---------------------------------------------------------------------------

describe("PixelSyncServer — receive: stroke conflict resolution", () => {
  it("applies the command to the world", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));

    server.receive(strokeCmd({ positions: [{ x: 2, y: 0 }], color: { r: 7, g: 7, b: 7, a: 255 } }));

    const buffer = server.world.getBuffer("tex1")!;
    assert.deepStrictEqual(buffer.samplePixel(2, 0), [7, 7, 7, 255]);
  });

  it("accepts a later timestamp at the same pixel", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));

    server.receive(strokeCmd({
      timestamp: 500, positions: [{ x: 0, y: 0 }], color: { r: 1, g: 1, b: 1, a: 255 }, clientId: "A"
    }));
    server.receive(strokeCmd({
      timestamp: 900, positions: [{ x: 0, y: 0 }], color: { r: 2, g: 2, b: 2, a: 255 }, clientId: "B"
    }));

    const buffer = server.world.getBuffer("tex1")!;
    assert.deepStrictEqual(buffer.samplePixel(0, 0), [2, 2, 2, 255]);
  });

  it("rejects a stale command at a pixel already written by a newer one", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));

    server.receive(strokeCmd({
      timestamp: 900, positions: [{ x: 0, y: 0 }], color: { r: 2, g: 2, b: 2, a: 255 }, clientId: "A"
    }));
    server.receive(strokeCmd({
      timestamp: 500, positions: [{ x: 0, y: 0 }], color: { r: 1, g: 1, b: 1, a: 255 }, clientId: "B"
    }));

    const buffer = server.world.getBuffer("tex1")!;
    assert.deepStrictEqual(buffer.samplePixel(0, 0), [2, 2, 2, 255]);
  });

  it("splits a stroke: accepts pixels that don't conflict, rejects the one that does", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));

    // (0,0) is claimed by a later command first.
    server.receive(strokeCmd({
      timestamp: 900, positions: [{ x: 0, y: 0 }], color: { r: 9, g: 9, b: 9, a: 255 }, clientId: "A"
    }));

    const client = createClient("A");
    server.connect(client);
    server.subscribe("A", "tex1");
    client.received.length = 0;

    // A stale stroke touching both (0,0) [conflict] and (1,1) [no conflict].
    server.receive(strokeCmd({
      timestamp: 500,
      positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      color: { r: 1, g: 1, b: 1, a: 255 },
      clientId: "B"
    }));

    const buffer = server.world.getBuffer("tex1")!;
    // (0,0) keeps the winning color, (1,1) got the new stroke's color.
    assert.deepStrictEqual(buffer.samplePixel(0, 0), [9, 9, 9, 255]);
    assert.deepStrictEqual(buffer.samplePixel(1, 1), [1, 1, 1, 255]);

    // Broadcast carries only the accepted pixel.
    assert.strictEqual(client.received.length, 1);
    const msg = client.received[0] as { type: string; data: PixelNetworkCommand; };
    assert.strictEqual(msg.type, "command");
    assert.strictEqual(msg.data.action, "stroke");
    if (msg.data.action === "stroke") {
      assert.deepStrictEqual(msg.data.metadata.positions, [{ x: 1, y: 1 }]);
    }
  });

  it("drops a stroke entirely (no broadcast) when every pixel is rejected", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));
    server.receive(strokeCmd({ timestamp: 900, positions: [{ x: 0, y: 0 }] }));

    const client = createClient("A");
    server.connect(client);
    server.subscribe("A", "tex1");
    client.received.length = 0;

    server.receive(strokeCmd({ timestamp: 500, positions: [{ x: 0, y: 0 }] }));

    assert.strictEqual(client.received.length, 0);
  });

  it("commands targeting an unknown buffer are dropped", () => {
    const server = new PixelSyncServer();
    assert.doesNotThrow(() => {
      server.receive(strokeCmd({ bufferId: "no-such" }));
    });
    assert.strictEqual(server.world.hasBuffer("no-such"), false);
  });
});

// ---------------------------------------------------------------------------
// receive: structural ops always accepted
// ---------------------------------------------------------------------------

describe("PixelSyncServer — receive: resized / texture-replaced", () => {
  it("resized is always accepted and broadcast", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));

    server.receive({
      action: "resized",
      bufferId: "tex1",
      metadata: { size: { x: 8, y: 2 } },
      clientId: "A",
      seq: 2,
      timestamp: 1
    });

    assert.deepStrictEqual(server.world.getBuffer("tex1")!.getSize(), { x: 8, y: 2 });
  });

  it("texture-replaced is always accepted and broadcast", () => {
    const server = new PixelSyncServer();
    server.receive(bufferAddedCmd("tex1"));

    const client = createClient("A");
    server.connect(client);
    server.subscribe("A", "tex1");
    client.received.length = 0;

    server.receive({
      action: "texture-replaced",
      bufferId: "tex1",
      metadata: { size: { x: 2, y: 2 }, pixels: "" },
      clientId: "B",
      seq: 2,
      timestamp: 1
    });

    assert.strictEqual(client.received.length, 1);
  });
});

// ---------------------------------------------------------------------------
// snapshot()
// ---------------------------------------------------------------------------

describe("PixelSyncServer — snapshot", () => {
  it("returns undefined for an unknown buffer", () => {
    const server = new PixelSyncServer();
    assert.strictEqual(server.snapshot("no-such"), undefined);
  });

  it("returns decodable pixel data reflecting the buffer's current state", () => {
    const server = new PixelSyncServer();
    server.world.addBuffer("tex1", { size: { x: 2, y: 2 } });
    server.receive(strokeCmd({ positions: [{ x: 0, y: 0 }], color: { r: 5, g: 6, b: 7, a: 255 } }));

    const snap = server.snapshot("tex1")!;
    assert.deepStrictEqual(snap.size, { x: 2, y: 2 });
    const pixels = toUint8Array(snap.pixels);
    assert.deepStrictEqual([pixels[0], pixels[1], pixels[2], pixels[3]], [5, 6, 7, 255]);
  });
});

describe("PixelSyncServer — custom world", () => {
  it("accepts an existing PixelWorld in options", () => {
    const world = new PixelWorld();
    world.addBuffer("pre-existing", { size: { x: 4, y: 4 } });

    const server = new PixelSyncServer({ world });
    assert.strictEqual(server.world, world);
    assert.ok(server.world.hasBuffer("pre-existing"));
  });
});
