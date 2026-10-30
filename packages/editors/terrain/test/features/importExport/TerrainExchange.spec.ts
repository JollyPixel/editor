// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import {
  chunkSampleCount,
  ChunkCoord,
  encodePng,
  InvalidImageError,
  SPLAT_TEXELS,
  TileCoord,
  TILE_SAMPLE_COUNT
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { TerrainExchange } from "#src/features/importExport/model/TerrainExchange.ts";
import {
  createTerrainHistory,
  TERRAIN_HISTORY_SCOPE
} from "#src/shared/terrainHistory.ts";

// CONSTANTS
const kRect = { x: 0, z: 0, columns: 2, rows: 1 };

function exchangeSetup() {
  const document = new TerrainDocument();
  document.addChunk(0, 0);
  document.addChunk(1, 0);
  document.addMaterial({ name: "Ground" });
  document.patchTiles([{
    tile: TileCoord.fromIndex(new ChunkCoord(1, 0), 0),
    heights: new Float32Array(TILE_SAMPLE_COUNT).fill(40)
  }]);
  const history = createTerrainHistory(document);
  const exchange = new TerrainExchange({ document, history, baseName: "world" });

  return { document, history, exchange };
}

function heightAt(
  document: TerrainDocument,
  x: number
): number | undefined {
  return document.terrain.chunk(new ChunkCoord(x, 0))?.height(0, 0);
}

describe("TerrainExchange", () => {
  for (const format of ["png", "raw"] as const) {
    test(`a ${format} heightmap and its sidecar import back with one undo step`, async() => {
      const { document, history, exchange } = exchangeSetup();
      const files = await exchange.exportHeightmap(kRect, 1, format);
      const extension = format === "png" ? "png" : "r16";
      assert.deepEqual(files.map(({ name }) => name), [`world.${extension}`, "world.json"]);

      const { image, sidecar } = await exchange.chooseHeightmap(files);
      assert.deepEqual(sidecar?.rect, kRect);
      await exchange.importHeightmap(image, kRect, 1, { min: 0, max: 80 });

      assert.equal(heightAt(document, 1), 80);
      const { undoLabel, undoCount } = history.state(TERRAIN_HISTORY_SCOPE);
      assert.deepEqual([undoLabel, undoCount], ["Import heightmap", 1]);
      assert.equal(history.undo(TERRAIN_HISTORY_SCOPE), true);
      assert.equal(heightAt(document, 1), 40);
    });
  }

  test("exports one mask named after each painted material and matches them back by name", async() => {
    const { document, exchange } = exchangeSetup();
    const files = await exchange.exportSplat(kRect);
    assert.deepEqual(files.map(({ name }) => name), ["world_ground.png"]);

    const stray = {
      name: "other.png",
      bytes: await encodePng({ width: 1, height: 1, depth: 8, samples: Uint16Array.of(1) })
    };
    const [ground, other] = await exchange.chooseMasks([...files, stray]);

    assert.equal(ground.slot, document.materials.materials()[0].slot);
    assert.equal(ground.image.width, SPLAT_TEXELS * 2);
    assert.equal(other.slot, null);
  });

  test("the whole rectangle spans every chunk", () => {
    const { document, exchange } = exchangeSetup();
    document.addChunk(1, -1);

    assert.deepEqual(exchange.wholeRect(), { x: 0, z: -1, columns: 2, rows: 2 });
  });

  test("refuses what cannot become an image or a heightmap", async() => {
    const { exchange } = exchangeSetup();
    const tooWide = { x: 0, z: 0, columns: 256, rows: 1 };
    const sidecar = { name: "map.json", bytes: new TextEncoder().encode("{}") };
    const image = { name: "map.png", bytes: new Uint8Array(4) };

    await assert.rejects(exchange.exportHeightmap(tooWide, 2, "png"), InvalidImageError);
    await assert.rejects(exchange.exportSplat(tooWide), InvalidImageError);
    await assert.rejects(exchange.chooseHeightmap([image, sidecar]), InvalidImageError);
    await assert.rejects(exchange.chooseHeightmap([sidecar]), InvalidImageError);
  });

  test("an image of another size is stretched over the rectangle at the chosen tier", async() => {
    const { document, exchange } = exchangeSetup();
    const samples = new Uint16Array(4).fill(65535);
    const image = { width: 2, height: 2, depth: 16, samples } as const;

    await exchange.importHeightmap(image, kRect, 2, { min: 0, max: 10 });

    const chunk = document.terrain.chunk(new ChunkCoord(0, 0))!;
    assert.equal(chunk.copyHeights().length, chunkSampleCount(2));
    assert.equal(chunk.sample(127, 127), 10);
  });
});
