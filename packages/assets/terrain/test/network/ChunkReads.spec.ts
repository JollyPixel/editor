// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TerrainCommand } from "#src/index.ts";
import type {
  ChunkContents,
  TerrainDocument
} from "#src/network/client.ts";
import { terrainPeers } from "../helpers/peers.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

// CONSTANTS
const kNear = new ChunkCoord(1, 0);
const kFar = new ChunkCoord(12, 0);
const kAbsent = new ChunkCoord(40, 0);
const kInnerTile = 5;

async function readChunks(
  document: TerrainDocument,
  coords: readonly ChunkCoord[]
): Promise<ChunkContents[]> {
  const contents: ChunkContents[] = [];
  for await (const chunk of document.stream.read(coords)) {
    contents.push(chunk);
  }

  return contents;
}

describe("chunk reads", () => {
  test("reading returns loaded and unloaded chunks, and leaves an unloaded one unsubscribed", async(t) => {
    const { server, join, route, dispose } = terrainPeers();
    t.after(dispose);
    for (let x = 1; x <= kFar.x; x++) {
      await server.receive("X", networkCommand(
        { action: "chunk-added", x, z: 0, heights: heights(x) },
        { clientId: "X" }
      ));
    }
    const near = await join("A");
    const far = await join("B", { streamCentre: kFar });

    const reading = readChunks(near.document, [kNear, kFar, kAbsent]);
    await setImmediate();
    await route();
    const [nearChunk, farChunk, ...others] = await reading;

    assert.equal(nearChunk.coord, kNear);
    assert.equal(nearChunk.heights[0], kNear.x);
    assert.equal(farChunk.coord.key, kFar.key);
    assert.equal(farChunk.heights[0], kFar.x);
    assert.equal(others.length, 0);
    assert.equal(near.document.terrain.has(kFar), false);

    const received: TerrainCommand[] = [];
    near.document.on("change", ({ command }) => received.push(command));
    far.document.patchTiles([{
      tile: TileCoord.fromIndex(kFar, kInnerTile),
      heights: tileHeights(30)
    }]);
    await route();
    assert.deepEqual(received, []);
  });
});
