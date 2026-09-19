// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelSyncClient } from "#src/network/PixelSyncClient.ts";
import {
  command,
  gray
} from "../fixtures/commands.ts";
import {
  asDocument,
  createPixelArtCanvas
} from "../helpers/canvas.ts";
import { callsOf } from "../helpers/mock.ts";
import { MockRoom } from "../helpers/room.ts";

// CONSTANTS
const kResized: PixelBufferHookEvent = {
  action: "resized",
  metadata: { size: { x: 1, y: 1 } }
};

function createHost() {
  return {
    onBufferUpdated: undefined as PixelBufferHookListener | undefined,
    applyRemoteCommand: mock.fn(),
    loadSnapshot: mock.fn()
  };
}

function setup() {
  const room = new MockRoom({ clientId: "client-A" });
  const host = createHost();
  const client = new PixelSyncClient({
    room,
    document: asDocument(host)
  });

  return {
    room,
    host,
    client
  };
}

describe("PixelSyncClient — document hook", () => {
  test("chains the existing onBufferUpdated handler", () => {
    const room = new MockRoom();
    const host = createHost();
    const previous = mock.fn<PixelBufferHookListener>();
    host.onBufferUpdated = previous;
    new PixelSyncClient({ room, document: asDocument(host) });

    host.onBufferUpdated?.(kResized);

    assert.deepStrictEqual(callsOf(previous), [[kResized]]);
    assert.strictEqual(room.sent.length, 1);
  });

  test("destroy restores the previous handler and stops sending", () => {
    const room = new MockRoom();
    const host = createHost();
    const previous = mock.fn<PixelBufferHookListener>();
    host.onBufferUpdated = previous;
    const client = new PixelSyncClient({ room, document: asDocument(host) });

    client.destroy();
    host.onBufferUpdated?.(kResized);

    assert.strictEqual(host.onBufferUpdated, previous);
    assert.strictEqual(room.sent.length, 0);
  });
});

describe("PixelSyncClient — local mutations", () => {
  test("stamps each command with the client id, an incrementing seq and the current time", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const { room, host } = setup();

    host.onBufferUpdated?.(kResized);
    host.onBufferUpdated?.(kResized);

    assert.deepStrictEqual(room.sent, [
      command("resized", kResized.metadata, { clientId: "client-A", seq: 1, timestamp: 1000 }),
      command("resized", kResized.metadata, { clientId: "client-A", seq: 2, timestamp: 1000 })
    ]);
  });
});

describe("PixelSyncClient — remote messages", () => {
  test("applies a command from another client", () => {
    const { room, host } = setup();
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "client-B" });

    room.deliverCommand(stroke);

    assert.deepStrictEqual(callsOf(host.applyRemoteCommand), [[stroke]]);
  });

  test("ignores its own echoed commands", () => {
    const { room, host } = setup();

    room.deliverCommand(command("resized", kResized.metadata, { clientId: "client-A" }));

    assert.strictEqual(host.applyRemoteCommand.mock.callCount(), 0);
  });

  test("loads a snapshot with decoded pixels", () => {
    const { room, host } = setup();

    room.deliverSnapshot({
      size: { x: 1, y: 1 },
      pixels: Buffer.from([1, 2, 3, 255]).toString("base64"),
      uvRegions: []
    });

    assert.deepStrictEqual(callsOf(host.loadSnapshot), [
      [{ x: 1, y: 1 }, new Uint8ClampedArray([1, 2, 3, 255]), []]
    ]);
  });

  test("emits the asset room rejected notice", () => {
    const { room, client } = setup();
    const notices: unknown[] = [];
    client.on("notice", (notice) => notices.push(notice));

    room.emit("message", { type: "rejected", reason: "disk full" });

    assert.deepStrictEqual(notices, [{ type: "rejected", reason: "disk full" }]);
  });

  test("becomes ready and emits \"ready\" once, on the first snapshot", () => {
    const { room, client } = setup();
    const ready = mock.fn();
    client.on("ready", ready);

    assert.strictEqual(client.ready, false);
    room.deliverSnapshot();
    room.deliverSnapshot();

    assert.strictEqual(client.ready, true);
    assert.strictEqual(ready.mock.callCount(), 1);
  });
});

describe("PixelSyncClient — destroy", () => {
  test("restores the document hook and stops handling room messages", () => {
    const { room, host, client } = setup();

    client.destroy();
    room.deliverSnapshot();
    host.onBufferUpdated?.(kResized);

    assert.strictEqual(host.onBufferUpdated, undefined);
    assert.strictEqual(host.loadSnapshot.mock.callCount(), 0);
    assert.strictEqual(room.sent.length, 0);
  });
});

describe("PixelSyncClient — UV region echoes", () => {
  function setupEcho() {
    const room: MockRoom = new MockRoom({
      onSend: (sent) => room.deliverCommand(sent)
    });
    const { manager: canvas } = createPixelArtCanvas({
      texture: { size: { x: 64, y: 64 }, maxSize: 64 },
      zoom: { default: 4 }
    });
    new PixelSyncClient({ room, document: canvas.document });
    const created: string[] = [];
    canvas.uv.on("region-created", ({ region }) => created.push(region.id));

    return {
      room,
      canvas,
      created
    };
  }

  test("creating a region broadcasts once and ignores the echo", () => {
    const { room, canvas, created } = setupEcho();

    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });

    assert.deepStrictEqual(room.sent.map((sent) => sent.action), ["uv-region-created"]);
    assert.deepStrictEqual(created, ["cube-a"]);
    assert.strictEqual([...canvas.uv.regions].length, 1);
    canvas.destroy();
  });

  test("a duplicate remote create updates the known region instead of recreating it", () => {
    const { room, canvas, created } = setupEcho();
    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });
    const stateChanges: string[] = [];
    canvas.uv.on("region-state-changed", ({ region }) => stateChanges.push(region.id));

    room.deliverCommand({ ...room.sent[0], clientId: "other-client" });

    assert.deepStrictEqual(created, ["cube-a"]);
    assert.deepStrictEqual(stateChanges, ["cube-a"]);
    assert.strictEqual([...canvas.uv.regions].length, 1);
    canvas.destroy();
  });

  test("a new remote region is created", () => {
    const { room, canvas, created } = setupEcho();
    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });
    const [sent] = room.sent;
    assert.strictEqual(sent.action, "uv-region-created");

    room.deliverCommand(command("uv-region-created", {
      region: { ...sent.metadata.region, id: "cube-b" }
    }, { clientId: "other-client" }));

    assert.deepStrictEqual(created, ["cube-a", "cube-b"]);
    assert.strictEqual([...canvas.uv.regions].length, 2);
    canvas.destroy();
  });
});
