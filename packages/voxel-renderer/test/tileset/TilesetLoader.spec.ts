// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TilesetLoader,
  type TilesetEntry
} from "../../src/tileset/TilesetLoader.ts";
import type { TilesetDefinition } from "../../src/tileset/TilesetManager.ts";
import type { VoxelWorldJSON } from "../../src/serialization/VoxelSerializer.ts";

// CONSTANTS
const kDefaultTilesetDef: TilesetDefinition = {
  id: "default",
  src: "/assets/tileset.png",
  tileSize: 16
};

const kSecondTilesetDef: TilesetDefinition = {
  id: "decor",
  src: "/assets/decor.png",
  tileSize: 16
};

/**
 * Structural mock for the texture loader — no THREE import needed.
 * Returns a minimal object that satisfies the `loadAsync` contract.
 */
function makeMockLoader(
  loadCalls: string[] = []
): { loadAsync(url: string): Promise<any>; } {
  return {
    async loadAsync(url: string) {
      loadCalls.push(url);

      return {
        magFilter: 0,
        minFilter: 0,
        colorSpace: "",
        generateMipmaps: true,
        image: { width: 256, height: 256 }
      };
    }
  };
}

function makeSnapshot(tilesetIds: string[]): VoxelWorldJSON {
  return {
    version: 1,
    chunkSize: 16,
    tilesets: tilesetIds.map((id) => {
      return {
        id,
        src: `/assets/${id}.png`,
        tileSize: 16
      };
    }),
    layers: []
  };
}

describe("TilesetLoader — initial state", () => {
  it("starts with an empty tilesets map", () => {
    const loader = new TilesetLoader({
      loader: makeMockLoader()
    });

    assert.equal(loader.tilesets.size, 0);
  });
});

describe("TilesetLoader.fromTileDefinition", () => {
  it("loads and stores { def, texture } under the tileset ID", async() => {
    const loader = new TilesetLoader({
      loader: makeMockLoader()
    });

    await loader.fromTileDefinition(kDefaultTilesetDef);

    assert.equal(loader.tilesets.size, 1);
    const entry = loader.tilesets.get("default") as TilesetEntry;
    assert.ok(entry !== undefined);
    assert.equal(entry.def.id, "default");
    assert.ok(entry.texture !== undefined);
  });

  it("is idempotent — mock loader is called exactly once for duplicate IDs", async() => {
    const calls: string[] = [];
    const loader = new TilesetLoader({
      loader: makeMockLoader(calls)
    });

    await loader.fromTileDefinition(kDefaultTilesetDef);
    await loader.fromTileDefinition(kDefaultTilesetDef);

    assert.equal(calls.length, 1);
    assert.equal(loader.tilesets.size, 1);
  });

  it("adds distinct entries for different IDs", async() => {
    const loader = new TilesetLoader({
      loader: makeMockLoader()
    });

    await loader.fromTileDefinition(kDefaultTilesetDef);
    await loader.fromTileDefinition(kSecondTilesetDef);

    assert.equal(loader.tilesets.size, 2);
    assert.ok(loader.tilesets.has("default"));
    assert.ok(loader.tilesets.has("decor"));
  });
});

describe("TilesetLoader.fromWorld", () => {
  it("loads all tilesets from a snapshot", async() => {
    const loader = new TilesetLoader({
      loader: makeMockLoader()
    });

    await loader.fromWorld(makeSnapshot(["terrain", "decor"]));

    assert.equal(loader.tilesets.size, 2);
    assert.ok(loader.tilesets.has("terrain"));
    assert.ok(loader.tilesets.has("decor"));
  });

  it("resolves without error when the snapshot has an empty tilesets array", async() => {
    const loader = new TilesetLoader({
      loader: makeMockLoader()
    });

    await loader.fromWorld(makeSnapshot([]));

    assert.equal(loader.tilesets.size, 0);
  });

  it("is idempotent across multiple calls — loads each tileset only once", async() => {
    const calls: string[] = [];
    const loader = new TilesetLoader({
      loader: makeMockLoader(calls)
    });

    await loader.fromWorld(makeSnapshot(["terrain"]));
    await loader.fromWorld(makeSnapshot(["terrain"]));

    assert.equal(calls.length, 1);
  });
});
