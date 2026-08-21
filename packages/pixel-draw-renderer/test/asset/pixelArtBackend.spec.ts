// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import {
  Server,
  type ClientHandle
} from "@jolly-pixel/network";
import {
  assetRoomName,
  createAssetBackend,
  FilesystemAssetSource,
  type Timers
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  pixelArtAssetHandler,
  PIXEL_ART_COMMAND,
  PIXEL_ART_KIND
} from "#src/asset/pixelArtAssetHandler.ts";
import {
  decodePixelArtDocument,
  encodePixelArtDocument,
  loadPixelArtDocument
} from "#src/asset/PixelArtDocument.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";

// CONSTANTS
const kSize = {
  x: 8,
  y: 8
};
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kDocumentPath = "textures/hero.pixelart";

interface ScheduledTask {
  id: number;
  at: number;
  handler: () => void;
}

interface ManualTimers extends Timers {
  now: number;
  advance(ms: number): void;
}

function manualTimers(): ManualTimers {
  let nextId = 1;
  let tasks: ScheduledTask[] = [];

  return {
    now: 0,
    setTimeout(handler, ms) {
      const task: ScheduledTask = {
        id: nextId++,
        at: this.now + ms,
        handler
      };
      tasks.push(task);

      return task.id;
    },
    clearTimeout(handle) {
      tasks = tasks.filter((task) => task.id !== handle);
    },
    advance(ms) {
      this.now += ms;
      const due = tasks.filter((task) => task.at <= this.now);
      tasks = tasks.filter((task) => task.at > this.now);
      for (const task of due) {
        task.handler();
      }
    }
  };
}

function tempRoot(): Promise<string> {
  return fs.mkdtemp(
    path.join(os.tmpdir(), "jolly-pixel-art-asset-")
  );
}

function client(
  id: string
): ClientHandle & { received: unknown[]; } {
  const received: unknown[] = [];

  return {
    id,
    received,
    send: (payload) => received.push(payload)
  };
}

function strokeCommand(
  positions: { x: number; y: number; }[],
  timestamp: number
): PixelNetworkCommand {
  return {
    action: "stroke",
    metadata: {
      color: kRed,
      positions
    },
    clientId: "unused",
    seq: 1,
    timestamp
  };
}

function commandCount(
  eventStore: EventStore.EventStore,
  assetId: string
): number {
  return eventStore.reader
    .list(assetId)
    .filter((event) => event.eventType === PIXEL_ART_COMMAND)
    .length;
}

/**
 * Replays an asset stream into a fresh buffer.
 */
function replay(
  eventStore: EventStore.EventStore,
  assetId: string
): PixelBuffer {
  const handler = pixelArtAssetHandler({ defaultSize: kSize });
  const state = handler.create(assetId);
  for (const event of eventStore.reader.list(assetId)) {
    handler.apply(state, event);
  }

  return state.buffer;
}

function bufferFromFile(
  data: Uint8Array
): PixelBuffer {
  const buffer = new PixelBuffer({ size: kSize });
  loadPixelArtDocument(buffer, decodePixelArtDocument(data));

  return buffer;
}

describe("pixel-art asset kind over a real back-end", () => {
  test("edits reach the file and a cold replay agrees with live state", async() => {
    const root = await tempRoot();

    try {
      using eventStore = EventStore.persistence.memory();
      await fs.mkdir(path.join(root, "textures"), { recursive: true });
      await fs.writeFile(
        path.join(root, kDocumentPath),
        encodePixelArtDocument(new PixelBuffer({ size: kSize }))
      );

      const timers = manualTimers();
      await using backend = await createAssetBackend({
        source: new FilesystemAssetSource(root),
        eventStore,
        handlers: [pixelArtAssetHandler({ defaultSize: kSize })],
        snapshot: {
          delay: 1_000,
          maxDelay: 5_000
        },
        timers,
        watch: false
      });

      const record = backend.catalog.snapshot().assets
        .find((entry) => entry.source === kDocumentPath)!;
      assert.strictEqual(record.kind, PIXEL_ART_KIND);

      const server = new Server({ eventStore });
      backend.attach(server);
      const room = assetRoomName(PIXEL_ART_KIND, record.id);

      const peer = client("A");
      server.handleConnect(peer);
      await server.handleMessage("A", {
        room,
        kind: "join"
      });
      await server.handleMessage("A", {
        room,
        kind: "message",
        payload: strokeCommand([
          { x: 1, y: 1 },
          { x: 2, y: 2 }
        ], 1_000)
      });

      assert.strictEqual(commandCount(eventStore, record.id), 1);

      // Commands do not update the source before a snapshot.
      assert.deepEqual(
        bufferFromFile(
          await fs.readFile(path.join(root, kDocumentPath))
        ).samplePixel(1, 1),
        [255, 255, 255, 255]
      );

      timers.advance(1_000);
      await backend.flush(record.id);

      const onDisk = bufferFromFile(
        await fs.readFile(path.join(root, kDocumentPath))
      );
      assert.deepEqual(onDisk.samplePixel(1, 1), [255, 0, 0, 255]);
      assert.deepEqual(onDisk.samplePixel(2, 2), [255, 0, 0, 255]);

      assert.deepEqual(
        replay(eventStore, record.id).pixels(),
        onDisk.pixels()
      );

      await server.close();
    }
    finally {
      await fs.rm(root, {
        recursive: true,
        force: true
      });
    }
  });

  test("a command losing conflict resolution is never appended", async() => {
    const root = await tempRoot();

    try {
      using eventStore = EventStore.persistence.memory();
      await fs.writeFile(
        path.join(root, "a.pixelart"),
        encodePixelArtDocument(new PixelBuffer({ size: kSize }))
      );

      await using backend = await createAssetBackend({
        source: new FilesystemAssetSource(root),
        eventStore,
        handlers: [pixelArtAssetHandler({ defaultSize: kSize })],
        watch: false
      });
      const record = backend.catalog.snapshot().assets[0];

      const server = new Server({ eventStore });
      backend.attach(server);
      const room = assetRoomName(PIXEL_ART_KIND, record.id);

      server.handleConnect(client("A"));
      server.handleConnect(client("B"));
      await server.handleMessage("A", {
        room,
        kind: "join"
      });
      await server.handleMessage("B", {
        room,
        kind: "join"
      });

      await server.handleMessage("A", {
        room,
        kind: "message",
        payload: strokeCommand([{ x: 0, y: 0 }], 2_000)
      });
      const afterFirst = commandCount(eventStore, record.id);

      // The older write loses.
      await server.handleMessage("B", {
        room,
        kind: "message",
        payload: strokeCommand([{ x: 0, y: 0 }], 1_000)
      });

      assert.strictEqual(commandCount(eventStore, record.id), afterFirst);

      await server.close();
    }
    finally {
      await fs.rm(root, {
        recursive: true,
        force: true
      });
    }
  });
});
