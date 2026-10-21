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
  toPixelDocumentCommand,
  toPixelCommand,
  type PixelDocumentCommand,
  type PixelChange,
  type PixelCommand
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelSyncClient, type PixelCommandListener } from "#src/network/PixelSyncClient.ts";
import { pixelEdits } from "#src/history/PixelEdits.ts";
import { command, gray } from "../fixtures/commands.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import { MockEmitter } from "../helpers/emitter.ts";
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
    command: PixelDocumentCommand
  ): PixelChange {
    const change = EditChange.local(command);
    this.emit("change", change);
    this.emit("command", toPixelCommand(command), change);

    return change;
  }

  edit(
    command: PixelCommand
  ): CommandChange<PixelDocumentCommand, null> {
    const change = EditChange.local(toPixelDocumentCommand(command));
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
    const confirmed: [CommandChange<PixelDocumentCommand, null>, number | undefined][] = [];
    pixelEdits(host).receipts.on("confirmed", (change, version) => confirmed.push([change, version]));
    room.deliverSnapshot();

    const change = host.edit(kResized);
    room.emit("message", { type: "command", data: room.sent[0], version: 5 });

    assert.deepStrictEqual(confirmed, [[change, 5]]);
  });

  test("sends an undo with the basis of its change", () => {
    const { room, host } = setup();

    pixelEdits(host).applyStep(toPixelDocumentCommand(kResized), 7);

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
