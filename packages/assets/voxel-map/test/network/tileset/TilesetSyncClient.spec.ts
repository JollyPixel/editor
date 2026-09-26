// Import Node.js Dependencies
import {
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  encodePixelBytes,
  type PixelBufferHookEvent,
  type PixelBufferHookListener,
  type UVRegionData,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import { TilesetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  TilesetSyncClient,
  type TilesetPixelsTarget,
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
}

class PixelsRecorder implements TilesetPixelsTarget {
  onBufferUpdated: PixelBufferHookListener | undefined;
  readonly remote: PixelBufferHookEvent[] = [];
  readonly loaded: LoadedSnapshot[] = [];

  applyRemoteCommand(
    event: PixelBufferHookEvent
  ): void {
    this.remote.push(event);
  }

  loadSnapshot(
    size: Vec2,
    pixels: Uint8ClampedArray,
    uvRegions: readonly (UVRegionData | { toJSON(): UVRegionData; })[] = []
  ): void {
    this.loaded.push({ size, pixels, uvRegions });
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

function noop(): void {
  return void 0;
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

    pixels.onBufferUpdated?.({
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

  it("destroy restores the pixel hook and stops forwarding", () => {
    const { room, pixels, tileset, client } = harness();
    const previous: PixelBufferHookListener = noop;
    const chained = new PixelsRecorder();
    chained.onBufferUpdated = previous;
    const wired = new TilesetSyncClient({
      room,
      pixels: chained,
      tileset: new TilesetDocument()
    });

    wired.destroy();
    client.destroy();
    tileset.defineBlock(makeBlockDef(3, "cube"));

    assert.equal(chained.onBufferUpdated, previous);
    assert.equal(pixels.onBufferUpdated, undefined);
    assert.equal(room.sentCommands.length, 0);
  });
});
