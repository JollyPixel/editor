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
  toPixelDocumentCommand,
  toPixelCommand,
  type PixelDocumentCommand,
  type PixelChange,
  type PixelCommand
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelCommandListener } from "#src/network/sync/PixelLink.ts";
import { PixelSyncClient } from "#src/network/sync/PixelSyncClient.ts";
import { pixelEdits } from "#src/history/PixelEdits.ts";
import {
  command,
  gray,
  packed
} from "../../fixtures/commands.ts";
import { MockEmitter } from "../../helpers/emitter.ts";
import { readCalls } from "../../helpers/mock.ts";
import { MockRoom } from "../../helpers/room.ts";

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

describe("PixelSyncClient — remote messages", () => {
  test("applies a command from another client", () => {
    const { room, host } = setup();
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "client-B" });

    room.deliverCommand(stroke);

    assert.deepStrictEqual(readCalls(host.applyRemoteCommand), [[stroke, "client-B"]]);
  });

  test("applies a packed command from another client unpacked", () => {
    const { room, host } = setup();
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }, { x: 3, y: 1 }]
    }, { clientId: "client-B" });

    room.deliverCommand(packed(stroke));

    assert.deepStrictEqual(readCalls(host.applyRemoteCommand), [[stroke, "client-B"]]);
  });

  test("applies a correction of its own command", () => {
    const { room, host } = setup();
    const correction = command("select-edit", {
      positions: [{ x: 0, y: 0 }],
      colors: [gray(3)]
    }, { clientId: "client-A" });

    room.deliverCommand(packed(correction), "correction");

    assert.deepStrictEqual(readCalls(host.applyRemoteCommand), [[correction, "client-A"]]);
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

    assert.deepStrictEqual(readCalls(host.loadSnapshot), [
      [{ size: { x: 1, y: 1 }, pixels: new Uint8ClampedArray([1, 2, 3, 255]), uvRegions: [] }]
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
    assert.deepStrictEqual(readCalls(host.loadSnapshot), [
      [{ size, pixels: new Uint8ClampedArray([1, 2, 3, 255]), uvRegions: [] }]
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
