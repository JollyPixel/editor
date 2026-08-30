// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  loadTilesets,
  type TextureSourceLoader
} from "../../src/tileset/loadTilesets.ts";
import type { TilesetDefinition } from "../../src/tileset/types.ts";
import { mockTexture } from "../helpers/mockTexture.ts";

// CONSTANTS
const kDefinitions: TilesetDefinition[] = [
  { id: "terrain", src: "/assets/terrain.png", tileSize: 16 },
  { id: "decor", src: "/assets/decor.png", tileSize: 16 }
];

function makeMockLoader(
  loadCalls: string[] = []
): TextureSourceLoader {
  return {
    async loadAsync(url: string) {
      loadCalls.push(url);

      return mockTexture(256, 256);
    }
  };
}

describe("loadTilesets", () => {
  it("returns one source per definition, in order", async() => {
    const sources = await loadTilesets(kDefinitions, {
      loader: makeMockLoader()
    });

    assert.deepEqual(sources.map((source) => source.def.id), ["terrain", "decor"]);
    assert.ok(sources.every((source) => source.texture !== undefined));
  });

  it("fetches a duplicated ID exactly once", async() => {
    const calls: string[] = [];
    const sources = await loadTilesets(
      [...kDefinitions, kDefinitions[0]],
      { loader: makeMockLoader(calls) }
    );

    assert.equal(calls.length, 2);
    assert.equal(sources.length, 2);
  });

  it("resolves to an empty list for an empty definition list", async() => {
    const calls: string[] = [];
    const sources = await loadTilesets([], { loader: makeMockLoader(calls) });

    assert.deepEqual(sources, []);
    assert.equal(calls.length, 0);
  });

  it("starts every fetch before awaiting the first one", async() => {
    const started: string[] = [];
    const resolvers: Array<() => void> = [];
    const loader: TextureSourceLoader = {
      async loadAsync(url: string) {
        started.push(url);
        await new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });

        return mockTexture(16, 16);
      }
    };

    const pending = loadTilesets(kDefinitions, { loader });
    await Promise.resolve();

    assert.equal(started.length, 2);
    resolvers.forEach((resolve) => resolve());
    await pending;
  });
});
