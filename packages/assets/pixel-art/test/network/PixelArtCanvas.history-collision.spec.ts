// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  Room,
  RoomContext,
  RoomEventStoreHandle
} from "@jolly-pixel/network";
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelSyncClient,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "#src/network/client.ts";
import {
  PixelSyncServer
} from "#src/network/server.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import { readPixel } from "../fixtures/canvas.ts";
import { mouseEvent, deleteKey } from "../helpers/events.ts";

function paintOnePixel(
  canvas: HTMLCanvasElement,
  positions: [number, number][]
): void {
  const [firstX, firstY] = positions[0];
  canvas.dispatchEvent(new MouseEvent("mousedown", {
    button: 0,
    buttons: 1,
    clientX: firstX,
    clientY: firstY,
    bubbles: true
  }));

  for (const [x, y] of positions.slice(1)) {
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1,
      clientX: x,
      clientY: y,
      bubbles: true
    }));
  }

  canvas.dispatchEvent(new MouseEvent("mouseup", {
    bubbles: true
  }));
}

/*
 * ---------------------------------------------------------------------------
 * Multiplayer collision handling: undo replays with the original action's
 * timestamp so the server's per-pixel LastWriteWinsResolver can re-race it
 * fairly against a peer's edit made in between.
 * ---------------------------------------------------------------------------
 */

interface RecordingRoom extends Room<PixelNetworkCommand, PixelServerMessage> {
  sentCommands: PixelNetworkCommand[];
  /** The RoomContext wired into the backing server — lets a test simulate a peer sending directly. */
  serverRoom: RoomContext;
}

// receive() never touches eventStore, so this fake room doesn't need a real one.
const unusedEventStore: RoomEventStoreHandle = {
  append: async() => true,
  list: async() => []
};

function isServerMessage(value: unknown): value is PixelServerMessage {
  return typeof value === "object" && value !== null && "type" in value;
}

/**
 * Wires a network.Room straight into a real PixelSyncServer in-process —
 * send feeds server.receive() directly, and the server's broadcast back to
 * this same client is dispatched as a "message" event on the room, exactly
 * as a real relay would.
 */
function makeServerBackedRoom(
  server: PixelSyncServer,
  clientId: string
): RecordingRoom {
  const sentCommands: PixelNetworkCommand[] = [];
  const listeners = new Map<string, Set<(payload: any) => void>>();

  function emit(type: string, payload: unknown): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  function handleFromServer(data: unknown): void {
    if (!isServerMessage(data)) {
      return;
    }

    emit("message", data);
  }

  /*
   * Normally provided by Server/ServerRoom — this single-client fake
   * just forwards straight back to the same client, mirroring `observe()` in
   * PixelSyncServer.spec.ts.
   */
  const serverRoom: RoomContext = {
    actor: {
      type: "user",
      id: "client-1"
    },
    room: {
      broadcast: handleFromServer,
      sendTo: (_clientId, payload) => handleFromServer(payload)
    },
    eventStore: unusedEventStore
  };

  const room: RecordingRoom = {
    id: "test-room",
    clientId,
    peers: new Map(),

    role: "default",

    rights: {},

    access: "write" as const,

    can: () => "write" as const,
    sentCommands,
    serverRoom,
    on: (type, listener) => {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    join() {
      // Unused by these tests.
    },
    send(cmd) {
      sentCommands.push(cmd);
      server.receive(cmd, serverRoom);
    },
    updatePresence() {
      // Unused by these tests.
    },
    leave() {
      // Unused by these tests.
    }
  };

  server.onClientConnect({
    id: clientId,
    send: handleFromServer
  });

  return room;
}

describe("PixelArtCanvas — history + network collision handling", () => {
  test("undo replays through onBufferUpdated stamped with the original stroke's timestamp, not now", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });

    const server = new PixelSyncServer({
      buffer: new PixelBuffer({ size: { x: 8, y: 8 } })
    });
    const { manager, canvas } = createPixelArtCanvas({
      zoom: {
        default: 4
      },
      brush: {
        size: 1,
        maxSize: 1
      },
      history: {
        enabled: true
      }
    });
    const room = makeServerBackedRoom(server, "A");
    const client = new PixelSyncClient({ room });
    client.attach(manager);

    t.mock.timers.tick(1000);
    paintOnePixel(canvas, [[88, 88]]);
    const originalCmd = room.sentCommands.at(-1)!;
    assert.strictEqual(originalCmd.timestamp, 1000);

    // now = 3000
    t.mock.timers.tick(2000);
    manager.undo();
    const undoCmd = room.sentCommands.at(-1)!;

    assert.strictEqual(undoCmd.action, "stroke");
    assert.strictEqual(undoCmd.timestamp, 1000);
    assert.notStrictEqual(undoCmd.timestamp, 3000);

    manager.destroy();
  });

  test("a peer's edit made after the original stroke survives an undo of that stroke", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });

    const server = new PixelSyncServer({
      buffer: new PixelBuffer({ size: { x: 8, y: 8 } })
    });
    const { manager, canvas } = createPixelArtCanvas({
      zoom: {
        default: 4
      },
      brush: {
        size: 1,
        maxSize: 1
      },
      history: {
        enabled: true
      }
    });
    const room = makeServerBackedRoom(server, "A");
    const client = new PixelSyncClient({ room });
    client.attach(manager);

    // A paints texture pixel (1,1) red at t=1000.
    t.mock.timers.tick(1000);
    paintOnePixel(canvas, [[88, 88]]);
    assert.deepStrictEqual(
      server.buffer.samplePixel(1, 1),
      [0, 0, 0, 255]
    );

    // B paints the SAME pixel blue at t=2000 — after A's original stroke.
    server.receive({
      action: "stroke",
      clientId: "B",
      seq: 1,
      timestamp: 2000,
      metadata: {
        color: { r: 0, g: 0, b: 255, a: 255 },
        positions: [{ x: 1, y: 1 }]
      }
    }, room.serverRoom);
    assert.deepStrictEqual(
      server.buffer.samplePixel(1, 1),
      [0, 0, 255, 255]
    );

    /*
     * A undoes their old stroke at t=3000. The replay is stamped with the
     * ORIGINAL timestamp (1000), so it loses to B's timestamp (2000) under
     * the server's per-pixel LastWriteWinsResolver.
     */
    t.mock.timers.tick(2000);
    manager.undo();

    assert.deepStrictEqual(
      server.buffer.samplePixel(1, 1),
      [0, 0, 255, 255],
      "B's newer edit must survive A's undo of an older, now-contested stroke"
    );

    manager.destroy();
  });

  test("select-edit: undo propagates to the server, not just the local buffer", () => {
    const server = new PixelSyncServer({
      buffer: new PixelBuffer({ size: { x: 8, y: 8 } })
    });
    const { manager, canvas } = createPixelArtCanvas({
      zoom: { default: 4 },
      brush: { size: 1, maxSize: 1 },
      history: { enabled: true }
    });
    const room = makeServerBackedRoom(server, "A");
    const client = new PixelSyncClient({ room });
    client.attach(manager);

    /*
     * texture (2,2) -> painted black, then selected and deleted (a
     * "select-edit" commit, dominant-border-color erase -> white).
     */
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 92));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    window.dispatchEvent(deleteKey());

    assert.deepStrictEqual(
      server.buffer.samplePixel(2, 2),
      [255, 255, 255, 255],
      "the delete's select-edit reached the server"
    );

    manager.undo();

    assert.deepStrictEqual(
      readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255],
      "local buffer reverted"
    );
    assert.deepStrictEqual(
      server.buffer.samplePixel(2, 2),
      [0, 0, 0, 255],
      "the undo's select-edit replay also reached the server — previously dropped entirely"
    );

    manager.destroy();
  });

  test(
    "regression: undoing overlapping same-client strokes (a chained Line's joint pixel) reverts server-side",
    (t) => {
      t.mock.timers.enable({ apis: ["Date"] });

      const server = new PixelSyncServer({
        buffer: new PixelBuffer({ size: { x: 8, y: 8 } })
      });
      const { manager, canvas } = createPixelArtCanvas({
        zoom: { default: 4 },
        brush: { size: 1, maxSize: 1 },
        history: { enabled: true }
      });
      const room = makeServerBackedRoom(server, "A");
      const client = new PixelSyncClient({ room });
      client.attach(manager);

      /*
       * Two overlapping strokes touching the same pixel, mirroring a
       * shift-chained Line's shared joint point: segment 1 paints (1,1) at
       * t=1000, segment 2 repaints the same pixel at t=2000.
       */
      t.mock.timers.tick(1000);
      paintOnePixel(canvas, [[88, 88]]);
      t.mock.timers.tick(1000);
      paintOnePixel(canvas, [[88, 88]]);

      assert.deepStrictEqual(
        server.buffer.samplePixel(1, 1),
        [0, 0, 0, 255]
      );

      /*
       * Undo is LIFO: segment 2 (t=2000) replays first, then segment 1
       * (t=1000) — an older-timestamped replay arriving after a newer one, at
       * the same pixel, from the same client.
       */
      t.mock.timers.tick(1000);
      manager.undo();
      manager.undo();

      assert.deepStrictEqual(
        readPixel(manager.texture, { x: 1, y: 1 }, 8),
        [255, 255, 255, 255],
        "local buffer fully reverted"
      );
      assert.deepStrictEqual(
        server.buffer.samplePixel(1, 1),
        [255, 255, 255, 255],
        "the server must also fully revert — previously stuck at segment 1's color"
      );

      manager.destroy();
    }
  );
});
