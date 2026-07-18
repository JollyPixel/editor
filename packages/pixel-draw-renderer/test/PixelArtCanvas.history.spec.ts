// Import Node.js Dependencies
import { describe, test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { PixelArtCanvas, type HistoryState } from "../src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "../src/buffer/hooks.ts";
import { PixelSyncServer } from "../src/network/PixelSyncServer.ts";
import { PixelSyncSession } from "../src/network/PixelSyncSession.ts";
import type { PixelTransport } from "../src/network/PixelTransport.ts";
import type { PixelBufferSnapshot, PixelNetworkCommand } from "../src/network/types.ts";
import { installCanvasMock, MockCanvasElement } from "./mocks.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  // @ts-expect-error
  globalThis.window = kEmulatedBrowserWindow as unknown as Window & typeof globalThis;
  // @ts-expect-error
  globalThis.getComputedStyle = (_el: unknown) => {
    return { backgroundColor: "#555555" };
  };
  globalThis.MouseEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).MouseEvent as typeof MouseEvent;
  installCanvasMock(globalThis.document);
});

function makeContainer(): { container: HTMLDivElement; children: MockCanvasElement[]; } {
  const div = kEmulatedBrowserWindow.document.createElement("div") as unknown as HTMLDivElement;
  const children: MockCanvasElement[] = [];
  (div as any).getBoundingClientRect = () => {
    return {
      left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200
    };
  };
  (div as any).style = {};
  (div as any).appendChild = (child: unknown) => {
    children.push(child as MockCanvasElement);
  };

  return { container: div, children };
}

function paintOnePixel(
  canvas: MockCanvasElement,
  positions: [number, number][]
): void {
  const [firstX, firstY] = positions[0];
  canvas.dispatchEvent(new MouseEvent("mousedown", {
    button: 0, buttons: 1, clientX: firstX, clientY: firstY, bubbles: true
  }));

  for (const [x, y] of positions.slice(1)) {
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1, clientX: x, clientY: y, bubbles: true
    }));
  }

  canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

function readPixel(
  pixels: Uint8ClampedArray,
  pos: { x: number; y: number; },
  width: number
): [number, number, number, number] {
  const i = (pos.y * width + pos.x) * 4;

  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

describe("PixelArtCanvas — history (undo/redo)", () => {
  let container: HTMLDivElement;
  let children: MockCanvasElement[];

  beforeEach(() => {
    ({ container, children } = makeContainer());
  });

  describe("disabled by default", () => {
    test("undo()/redo() are no-ops and canUndo()/canRedo() stay false", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);

      assert.strictEqual(manager.canUndo(), false);
      assert.strictEqual(manager.undo(), false);
      assert.strictEqual(manager.canRedo(), false);
      assert.strictEqual(manager.redo(), false);
      manager.destroy();
    });
  });

  describe("enabled — stroke round trip", () => {
    test("undo reverts a painted pixel; redo re-applies it", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true }
      });
      const canvas = children[0];

      // (88,88) -> texture (1,1)
      paintOnePixel(canvas, [[88, 88]]);
      assert.strictEqual(manager.canUndo(), true);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), [0, 0, 0, 255]);

      assert.strictEqual(manager.undo(), true);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), [255, 255, 255, 255]);
      assert.strictEqual(manager.canUndo(), false);
      assert.strictEqual(manager.canRedo(), true);

      assert.strictEqual(manager.redo(), true);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 1, y: 1 }, 8), [0, 0, 0, 255]);
      assert.strictEqual(manager.canRedo(), false);
      manager.destroy();
    });

    test("undo/redo re-emit onBufferUpdated so network sync stays consistent", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true },
        onBufferUpdated: (event) => events.push(event)
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.strictEqual(events.length, 1);

      manager.undo();
      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[1].action, "stroke");

      manager.redo();
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[2].action, "stroke");
      manager.destroy();
    });

    test("a new edit after undo clears the redo stack", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      manager.undo();
      assert.strictEqual(manager.canRedo(), true);

      paintOnePixel(canvas, [[92, 88]]);
      assert.strictEqual(manager.canRedo(), false);
      manager.destroy();
    });
  });

  describe("global fill round trip", () => {
    test("undo reverts a global fill to the exact pre-fill colors; redo re-applies it", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 4, y: 4 } },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        history: { enabled: true }
      });
      manager.fillGlobal = true;
      const canvas = children[0];

      // 4x4 texture, zoom 4 -> centered camera (92,92); client(100,100) -> texture (2,2).
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      assert.strictEqual(manager.canUndo(), true);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 2, y: 2 }, 4), [255, 0, 0, 255]);

      assert.strictEqual(manager.undo(), true);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 2, y: 2 }, 4), [255, 255, 255, 255]);
      assert.strictEqual(manager.canRedo(), true);

      assert.strictEqual(manager.redo(), true);
      assert.deepStrictEqual(readPixel(manager.texture, { x: 2, y: 2 }, 4), [255, 0, 0, 255]);
      manager.destroy();
    });

    test("undo/redo of a global fill re-emit onBufferUpdated as a full-position 'stroke' event", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 4, y: 4 } },
        zoom: { default: 4 },
        defaultMode: "fill",
        brush: { color: "#FF0000" },
        history: { enabled: true },
        onBufferUpdated: (event) => events.push(event)
      });
      manager.fillGlobal = true;
      const canvas = children[0];

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
      }));
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "global-fill");

      manager.undo();
      assert.strictEqual(events.length, 2);
      assert.strictEqual(events[1].action, "stroke");

      manager.redo();
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[2].action, "stroke");
      manager.destroy();
    });
  });

  describe("onHistoryChange", () => {
    test("fires after a push, an undo, and a redo", () => {
      const states: HistoryState[] = [];
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true },
        onHistoryChange: (state) => states.push(state)
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.deepStrictEqual(states.at(-1), { canUndo: true, canRedo: false });

      manager.undo();
      assert.deepStrictEqual(states.at(-1), { canUndo: false, canRedo: true });

      manager.redo();
      assert.deepStrictEqual(states.at(-1), { canUndo: true, canRedo: false });
      manager.destroy();
    });
  });

  describe("limit", () => {
    test("only the configured number of most-recent edits are undoable", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true, limit: 1 }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      paintOnePixel(canvas, [[92, 88]]);

      assert.strictEqual(manager.undo(), true);
      assert.strictEqual(manager.undo(), false);
      manager.destroy();
    });
  });

  describe("resized / texture-replaced", () => {
    test("undo restores the previous texture size", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        history: { enabled: true }
      });

      manager.textureSize = { x: 4, y: 4 };
      assert.deepStrictEqual(manager.textureSize, { x: 4, y: 4 });

      manager.undo();
      assert.deepStrictEqual(manager.textureSize, { x: 8, y: 8 });
      manager.destroy();
    });
  });

  describe("clearing on remote structural changes", () => {
    test("a remote 'resized' command clears the local undo stack", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.strictEqual(manager.canUndo(), true);

      manager.applyRemoteCommand({ action: "resized", metadata: { size: { x: 4, y: 4 } } });
      assert.strictEqual(manager.canUndo(), false);
      manager.destroy();
    });

    test("a remote 'texture-replaced' command clears the local undo stack", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.strictEqual(manager.canUndo(), true);

      const pixels = new Uint8ClampedArray(2 * 2 * 4).fill(200);
      const base64 = Buffer.from(pixels).toString("base64");
      manager.applyRemoteCommand({
        action: "texture-replaced",
        metadata: { size: { x: 2, y: 2 }, pixels: base64 }
      });
      assert.strictEqual(manager.canUndo(), false);
      manager.destroy();
    });

    test("loadSnapshot clears the local undo stack", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.strictEqual(manager.canUndo(), true);

      manager.loadSnapshot({ x: 3, y: 3 }, new Uint8ClampedArray(3 * 3 * 4));
      assert.strictEqual(manager.canUndo(), false);
      manager.destroy();
    });

    test("a remote 'stroke' command does NOT clear the local undo stack", () => {
      const manager = new PixelArtCanvas(container, {
        texture: { maxSize: 32, size: { x: 8, y: 8 } },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true }
      });
      const canvas = children[0];

      paintOnePixel(canvas, [[88, 88]]);
      assert.strictEqual(manager.canUndo(), true);

      manager.applyRemoteCommand({
        action: "stroke",
        metadata: { color: { r: 9, g: 8, b: 7, a: 255 }, positions: [{ x: 0, y: 0 }] }
      });
      assert.strictEqual(manager.canUndo(), true);
      manager.destroy();
    });
  });
});

// ---------------------------------------------------------------------------
// Multiplayer collision handling: undo replays with the original action's
// timestamp so the server's per-pixel LastWriteWinsResolver can re-race it
// fairly against a peer's edit made in between.
// ---------------------------------------------------------------------------

interface RecordingTransport extends PixelTransport {
  sentCommands: PixelNetworkCommand[];
}

type ServerMessage =
  | { type: "peer-joined"; peerId: string; }
  | { type: "peer-left"; peerId: string; }
  | { type: "command"; data: PixelNetworkCommand; }
  | { type: "snapshot"; bufferId: string; data: PixelBufferSnapshot; };

function isServerMessage(value: unknown): value is ServerMessage {
  return typeof value === "object" && value !== null && "type" in value;
}

/**
 * Wires a PixelTransport straight into a real PixelSyncServer in-process —
 * sendCommand feeds server.receive() directly, and the server's broadcast
 * back to this same client is routed back into transport.onCommand, exactly
 * as a real relay would.
 */
function makeServerBackedTransport(
  server: PixelSyncServer,
  clientId: string
): RecordingTransport {
  const sentCommands: PixelNetworkCommand[] = [];

  const transport: RecordingTransport = {
    localClientId: clientId,
    sentCommands,
    onCommand: null,
    onSnapshot: null,
    onPeerJoined: null,
    onPeerLeft: null,
    sendCommand(cmd) {
      sentCommands.push(cmd);
      server.receive(cmd);
    },
    subscribe(bufferId) {
      server.subscribe(clientId, bufferId);
    },
    unsubscribe(bufferId) {
      server.unsubscribe(clientId, bufferId);
    }
  };

  server.connect({
    id: clientId,
    send(data) {
      if (!isServerMessage(data)) {
        return;
      }

      if (data.type === "command") {
        transport.onCommand?.(data.data);
      }
      else if (data.type === "snapshot") {
        transport.onSnapshot?.(data.bufferId, data.data);
      }
    }
  });

  return transport;
}

describe("PixelArtCanvas — history + network collision handling", () => {
  let container: HTMLDivElement;
  let children: MockCanvasElement[];

  beforeEach(() => {
    ({ container, children } = makeContainer());
  });

  test("undo replays through onBufferUpdated stamped with the original stroke's timestamp, not now", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });

    const server = new PixelSyncServer();
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      brush: { size: 1, maxSize: 1 },
      history: { enabled: true }
    });
    const canvas = children[0];
    const transport = makeServerBackedTransport(server, "A");
    const session = new PixelSyncSession({ transport });
    session.createBuffer("tex1", manager, { size: { x: 8, y: 8 } });

    t.mock.timers.tick(1000);
    paintOnePixel(canvas, [[88, 88]]);
    const originalCmd = transport.sentCommands.at(-1)!;
    assert.strictEqual(originalCmd.timestamp, 1000);

    // now = 3000
    t.mock.timers.tick(2000);
    manager.undo();
    const undoCmd = transport.sentCommands.at(-1)!;

    assert.strictEqual(undoCmd.action, "stroke");
    assert.strictEqual(undoCmd.timestamp, 1000);
    assert.notStrictEqual(undoCmd.timestamp, 3000);

    manager.destroy();
  });

  test("a peer's edit made after the original stroke survives an undo of that stroke", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });

    const server = new PixelSyncServer();
    const manager = new PixelArtCanvas(container, {
      texture: { maxSize: 32, size: { x: 8, y: 8 } },
      brush: { size: 1, maxSize: 1 },
      history: { enabled: true }
    });
    const canvas = children[0];
    const transport = makeServerBackedTransport(server, "A");
    const session = new PixelSyncSession({ transport });
    session.createBuffer("tex1", manager, { size: { x: 8, y: 8 } });

    // A paints texture pixel (1,1) red at t=1000.
    t.mock.timers.tick(1000);
    paintOnePixel(canvas, [[88, 88]]);
    assert.deepStrictEqual(
      server.world.getBuffer("tex1")!.samplePixel(1, 1),
      [0, 0, 0, 255]
    );

    // B paints the SAME pixel blue at t=2000 — after A's original stroke.
    server.receive({
      action: "stroke",
      bufferId: "tex1",
      clientId: "B",
      seq: 1,
      timestamp: 2000,
      metadata: { color: { r: 0, g: 0, b: 255, a: 255 }, positions: [{ x: 1, y: 1 }] }
    });
    assert.deepStrictEqual(
      server.world.getBuffer("tex1")!.samplePixel(1, 1),
      [0, 0, 255, 255]
    );

    // A undoes their old stroke at t=3000. The replay is stamped with the
    // ORIGINAL timestamp (1000), so it loses to B's timestamp (2000) under
    // the server's per-pixel LastWriteWinsResolver.
    t.mock.timers.tick(2000);
    manager.undo();

    assert.deepStrictEqual(
      server.world.getBuffer("tex1")!.samplePixel(1, 1),
      [0, 0, 255, 255],
      "B's newer edit must survive A's undo of an older, now-contested stroke"
    );

    manager.destroy();
  });
});
