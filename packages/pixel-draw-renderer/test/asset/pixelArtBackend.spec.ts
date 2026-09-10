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
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import {
  Server,
  type ClientHandle
} from "@jolly-pixel/network";
import {
  assetRoomName,
  createAssetBackend
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
  deserializePixelBuffer,
  serializePixelBuffer
} from "#src/serialization/index.ts";
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
  deserializePixelBuffer(decodePixelArtDocument(data), buffer);

  return buffer;
}

describe("pixel-art asset kind over a real back-end", () => {
  test("edits reach the file and a cold replay agrees with live state", async(t) => {
    const root = await tempRoot();

    try {
      using eventStore = EventStore.persistence.memory();
      await fs.mkdir(path.join(root, "textures"), { recursive: true });
      await fs.writeFile(
        path.join(root, kDocumentPath),
        encodePixelArtDocument(
          serializePixelBuffer(new PixelBuffer({ size: kSize }))
        )
      );

      t.mock.timers.enable({ apis: ["setTimeout"] });
      await using backend = await createAssetBackend({
        source: new FilesystemAssetSource(root),
        eventStore,
        handlers: [pixelArtAssetHandler({ defaultSize: kSize })],
        snapshot: {
          delay: 1_000,
          maxDelay: 5_000
        },
        watch: false
      });

      const record = backend.catalog.snapshot().assets
        .find((entry) => entry.source === kDocumentPath)!;
      assert.strictEqual(record.kind, PIXEL_ART_KIND);

      const server = new Server({ eventStore });
      backend.attach(server);
      const room = assetRoomName(PIXEL_ART_KIND, record.id);

      const peer = client("A");
      server.handleConnect(peer, { subject: peer.id, role: "default" });
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

      t.mock.timers.tick(1_000);
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
        encodePixelArtDocument(
          serializePixelBuffer(new PixelBuffer({ size: kSize }))
        )
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

      server.handleConnect(client("A"), { subject: "A", role: "default" });
      server.handleConnect(client("B"), { subject: "B", role: "default" });
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
