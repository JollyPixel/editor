// Import Node.js Dependencies
import {
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PixelSyncTarget } from "@jolly-pixel/asset.pixel-art/client";
import {
  encodePixelBytes,
  encodePngPixels,
  type PixelBufferHookEvent,
  type PixelBufferHookListener,
  NormalMapConfig,
  type NormalMapData,
  type UVRegionData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import { TilesetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  TilesetSyncClient,
  type TilesetSnapshot
} from "#src/network/client.ts";
import {
  makeBlockDef,
  makeResolvedBlockDef
} from "../../helpers/blocks.ts";
import { createMockTilesetRoom } from "../../helpers/tilesetRoom.ts";

// CONSTANTS
const kPeerHeader = {
  clientId: "client-B",
  seq: 1,
  timestamp: 1000
};
const kBlack = {
  r: 0,
  g: 0,
  b: 0,
  a: 255
};

interface LoadedSnapshot {
  size: Vec2;
  pixels: Uint8ClampedArray;
  uvRegions: readonly (UVRegionData | { toJSON(): UVRegionData; })[];
  normalMap: NormalMapData | null;
}

class PixelsRecorder implements PixelSyncTarget {
  readonly listeners = new Set<PixelBufferHookListener>();
  readonly remote: PixelBufferHookEvent[] = [];
  readonly loaded: LoadedSnapshot[] = [];

  on(
    _event: "buffer-updated",
    listener: PixelBufferHookListener
  ): void {
    this.listeners.add(listener);
  }

  off(
    _event: "buffer-updated",
    listener: PixelBufferHookListener
  ): void {
    this.listeners.delete(listener);
  }

  emitLocal(
    event: PixelBufferHookEvent
  ): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.remote.push(event);
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: readonly (UVRegionData | { toJSON(): UVRegionData; })[] = [],
    normalMap: NormalMapData | null = null
  ): void {
    this.loaded.push({
      size,
      pixels,
      uvRegions,
      normalMap
    });
  }
}

function snapshot(): TilesetSnapshot {
  return {
    tileSize: 8,
    pixels: {
      size: { x: 1, y: 1 },
      pixels: encodePixelBytes(new Uint8ClampedArray([9, 8, 7, 255])),
      uvRegions: []
    },
    blocks: [makeResolvedBlockDef(2, "slope")],
    materialGroups: [{ id: "gold", metalness: 1 }]
  };
}

function harness() {
  const room = createMockTilesetRoom();
  const pixels = new PixelsRecorder();
  const tileset = new TilesetDocument();
  const client = new TilesetSyncClient({ room, pixels, tileset });

  return { room, pixels, tileset, client };
}

describe("TilesetSyncClient", () => {
  it("loads a snapshot into the pixels and the document, then is ready", () => {
    const { room, pixels, tileset, client } = harness();

    assert.equal(client.ready, false);
    room.simulateSnapshot(snapshot());

    assert.equal(client.ready, true);
    assert.deepEqual(pixels.loaded[0]?.size, { x: 1, y: 1 });
    assert.deepEqual([...pixels.loaded[0].pixels], [9, 8, 7, 255]);
    assert.equal(tileset.tileSize, 8);
    assert.equal(tileset.blocks.get(2)?.shapeId, "slope");
    assert.equal(tileset.materialGroups.get("gold")?.metalness, 1);
    assert.equal(room.sentCommands.length, 0);
  });

  it("loads neither half of a snapshot holding an invalid block", () => {
    const { room, pixels, tileset } = harness();

    assert.throws(() => room.simulateSnapshot({
      ...snapshot(),
      blocks: [makeResolvedBlockDef(0x10000, "cube")]
    }), RangeError);
    assert.equal(pixels.loaded.length, 0);
    assert.equal(tileset.blocks.size, 0);
  });

  it("sends local pixel edits and local document commands with one seq", () => {
    const { room, pixels, tileset } = harness();

    pixels.emitLocal({
      action: "stroke",
      metadata: { color: kBlack, positions: [{ x: 0, y: 0 }] },
      originTimestamp: 42
    });
    tileset.defineBlock(makeBlockDef(3, "cube"));
    tileset.resizeTiles(16);

    assert.deepEqual(
      room.sentCommands.map(({ action, seq, clientId }) => [action, seq, clientId]),
      [
        ["stroke", 1, "client-A"],
        ["block-defined", 2, "client-A"],
        ["tile-size-updated", 3, "client-A"]
      ]
    );
    assert.equal(room.sentCommands[0].timestamp, 42);
  });

  it("loads PNG pixels before the commands that follow the snapshot", async() => {
    const { room, pixels, tileset, client } = harness();
    const size = { x: 1, y: 1 };

    room.simulateSnapshot({
      ...snapshot(),
      pixels: {
        size,
        pixels: await encodePngPixels(
          new Uint8ClampedArray([9, 8, 7, 255]),
          size
        ),
        uvRegions: []
      }
    });
    room.simulateCommand({
      ...kPeerHeader,
      action: "block-removed",
      blockId: 2
    });
    assert.equal(client.ready, false);
    await client.whenReady();

    assert.deepEqual([...pixels.loaded[0].pixels], [9, 8, 7, 255]);
    assert.equal(tileset.blocks.has(2), false);
  });

  it("applies remote pixel and document commands without echoing them", () => {
    const { room, pixels, tileset } = harness();
    room.simulateSnapshot(snapshot());

    room.simulateCommand({
      ...kPeerHeader,
      action: "stroke",
      metadata: { color: kBlack, positions: [{ x: 0, y: 0 }] }
    });
    room.simulateCommand({
      ...kPeerHeader,
      action: "block-removed",
      blockId: 2
    });

    assert.equal(pixels.remote[0]?.action, "stroke");
    assert.equal(tileset.blocks.has(2), false);
    assert.equal(room.sentCommands.length, 0);
  });

  it("hands the normal map settings to the pixels with the snapshot and later commands", () => {
    const { room, pixels } = harness();
    const config = NormalMapConfig.create().toJSON();
    const base = snapshot();

    room.simulateSnapshot({
      ...base,
      pixels: {
        ...base.pixels,
        normalMap: config
      }
    });
    room.simulateCommand({
      ...kPeerHeader,
      action: "normal-map-toggled",
      metadata: { config: null }
    });

    assert.deepEqual(pixels.loaded[0]?.normalMap, config);
    assert.equal(pixels.remote[0]?.action, "normal-map-toggled");
    assert.deepEqual(pixels.remote[0].metadata, { config: null });
  });

  it("ignores the echo of its own command", () => {
    const { room, tileset } = harness();
    room.simulateSnapshot(snapshot());

    room.simulateCommand({
      ...kPeerHeader,
      clientId: "client-A",
      action: "block-removed",
      blockId: 2
    });

    assert.equal(tileset.blocks.has(2), true);
  });

  it("destroy unsubscribes from the pixels and stops forwarding", () => {
    const { room, pixels, tileset, client } = harness();

    client.destroy();
    tileset.defineBlock(makeBlockDef(3, "cube"));

    assert.equal(pixels.listeners.size, 0);
    assert.equal(room.sentCommands.length, 0);
  });
});
