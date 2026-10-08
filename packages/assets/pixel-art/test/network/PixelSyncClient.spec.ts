// Import Node.js Dependencies
import {
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { CommandChange } from "@jolly-pixel/history";
import {
  EditChange,
  encodePngPixels,
  toDocumentCommand,
  toPixelCommand,
  type DocumentCommand,
  type PixelChange,
  type PixelCommand
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelSyncClient,
  type PixelCommandListener
} from "#src/network/PixelSyncClient.ts";
import { pixelEdits } from "#src/history/PixelEdits.ts";
import {
  command,
  gray,
  packed
} from "../fixtures/commands.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import { MockEmitter } from "../helpers/emitter.ts";
import { callsOf } from "../helpers/mock.ts";
import { MockRoom } from "../helpers/room.ts";

// CONSTANTS
const kResized: PixelCommand = {
  action: "resized",
  metadata: { size: { x: 1, y: 1 } }
};

class Host extends MockEmitter<{
  command: PixelCommandListener;
  change: (change: PixelChange) => void;
  reset: (cause: "load") => void;
}> {
  applyRemoteCommand = mock.fn();
  replayPendingCommand = mock.fn();
  loadSnapshot = mock.fn();

  subscribe(
    event: "change",
    listener: (change: PixelChange) => void
  ): () => void;
  subscribe(
    event: "reset",
    listener: (cause: "load") => void
  ): () => void;
  subscribe(
    event: "change" | "reset",
    listener: ((change: PixelChange) => void) | ((cause: "load") => void)
  ): () => void {
    this.on(event, listener);

    return () => this.off(event, listener);
  }

  applyStep(
    command: DocumentCommand
  ): PixelChange {
    const change = EditChange.local(command);
    this.emit("change", change);
    this.emit("command", toPixelCommand(command), change);

    return change;
  }

  edit(
    command: PixelCommand
  ): CommandChange<DocumentCommand, null> {
    const change = EditChange.local(toDocumentCommand(command));
    this.emit("change", change);
    this.emit("command", command, change);

    return pixelEdits(this).adapt(change);
  }
}

function createHost() {
  return new Host();
}

function setup() {
  const room = new MockRoom({ clientId: "client-A" });
  const host = createHost();
  const client = new PixelSyncClient({
    room,
    document: host
  });

  return {
    room,
    host,
    client
  };
}

describe("PixelSyncClient — document events", () => {
  test("sends each document command", () => {
    const { room, host } = setup();

    host.edit(kResized);

    assert.strictEqual(room.sent.length, 1);
  });

  test("shares the command event with other listeners", () => {
    const { manager: canvas } = createPixelArtCanvas();
    const heard: PixelCommand[] = [];
    canvas.document.on("command", (event) => heard.push(event));
    const room = new MockRoom({ clientId: "client-A" });
    new PixelSyncClient({ room, document: canvas.document });

    canvas.document.paintPixels([{ x: 0, y: 0 }], gray(1));

    assert.strictEqual(heard.length, 1);
    assert.strictEqual(room.sent.length, 1);
    canvas.destroy();
  });
});

describe("PixelSyncClient — receipts", () => {
  test("confirms the change behind an acknowledged command, with its version", () => {
    const { room, host } = setup();
    const confirmed: [CommandChange<DocumentCommand, null>, number | undefined][] = [];
    pixelEdits(host).receipts.on("confirmed", (change, version) => confirmed.push([change, version]));
    room.deliverSnapshot();

    const change = host.edit(kResized);
    room.emit("message", { type: "command", data: room.sent[0], version: 5 });

    assert.deepStrictEqual(confirmed, [[change, 5]]);
  });

  test("sends an undo with the basis of its change", () => {
    const { room, host } = setup();

    pixelEdits(host).applyStep(toDocumentCommand(kResized), 7);

    assert.strictEqual(room.sent[0].basis, 7);
  });

  test("attaches the receipts until destroyed", () => {
    const { host, client } = setup();

    assert.strictEqual(pixelEdits(host).receipts.attached, true);
    client.destroy();
    assert.strictEqual(pixelEdits(host).receipts.attached, false);
  });
});

describe("PixelSyncClient — local mutations", () => {
  test("stamps each command with the client id, an incrementing seq and the current time", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const { room, host } = setup();

    host.edit(kResized);
    host.edit(kResized);

    assert.deepStrictEqual(room.sent, [
      command("resized", kResized.metadata, { clientId: "client-A", seq: 1, timestamp: 1000 }),
      command("resized", kResized.metadata, { clientId: "client-A", seq: 2, timestamp: 1000 })
    ]);
  });

  test("sends strokes and selection edits packed", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    const { room, host } = setup();

    host.edit({
      action: "stroke",
      metadata: { color: gray(1), positions: [{ x: 2, y: 3 }] }
    });
    host.edit({
      action: "select-edit",
      metadata: { positions: [{ x: 4, y: 5 }], colors: [gray(2)] }
    });

    assert.deepStrictEqual(room.sent.map((sent) => sent.metadata), [
      { color: gray(1), xy: [2, 3] },
      { xy: [4, 5], rgba: [2, 2, 2, 255] }
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

    assert.deepStrictEqual(callsOf(host.applyRemoteCommand), [[stroke, "client-B"]]);
  });

  test("applies a packed command from another client unpacked", () => {
    const { room, host } = setup();
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }, { x: 3, y: 1 }]
    }, { clientId: "client-B" });

    room.deliverCommand(packed(stroke));

    assert.deepStrictEqual(callsOf(host.applyRemoteCommand), [[stroke, "client-B"]]);
  });

  test("applies a correction of its own command", () => {
    const { room, host } = setup();
    const correction = command("select-edit", {
      positions: [{ x: 0, y: 0 }],
      colors: [gray(3)]
    }, { clientId: "client-A" });

    room.deliverCommand(packed(correction), "correction");

    assert.deepStrictEqual(callsOf(host.applyRemoteCommand), [[correction, "client-A"]]);
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
      [{ x: 1, y: 1 }, new Uint8ClampedArray([1, 2, 3, 255]), [], null, undefined]
    ]);
  });

  test("loads a PNG snapshot before the commands that follow it", async() => {
    const { room, host, client } = setup();
    const order: string[] = [];
    host.loadSnapshot.mock.mockImplementation(() => {
      order.push("snapshot");
    });
    host.applyRemoteCommand.mock.mockImplementation(() => {
      order.push("command");
    });
    const size = { x: 1, y: 1 };

    room.deliverSnapshot({
      size,
      pixels: await encodePngPixels(new Uint8ClampedArray([1, 2, 3, 255]), size),
      uvRegions: []
    });
    room.deliverCommand(command("resized", kResized.metadata, { clientId: "peer" }));
    assert.deepStrictEqual(order, []);
    await client.whenReady();

    assert.deepStrictEqual(order, ["snapshot", "command"]);
    assert.deepStrictEqual(callsOf(host.loadSnapshot), [
      [size, new Uint8ClampedArray([1, 2, 3, 255]), [], null, undefined]
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
  test("stops sending document commands and handling room messages", () => {
    const { room, host, client } = setup();

    client.destroy();
    room.deliverSnapshot();
    host.edit(kResized);

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
