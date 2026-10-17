// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  deserializeVoxelWorld,
  VOXEL_WORLD_VERSION,
  VoxelWorld,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TiledConverter, type TiledMap } from "../src/index.ts";

function simpleSrc(_src: string, id: string) {
  return `/assets/${id}.png`;
}

function voxelKeys(
  document: VoxelWorldJSON,
  layerIndex: number
): string[] {
  const world = new VoxelWorld(document.chunkSize);
  deserializeVoxelWorld(document, world);

  const { id } = document.layers[layerIndex];
  const layer = world.getLayers().find((candidate) => candidate.id === id);
  assert.ok(layer !== undefined);

  return Array.from(layer.localVoxels(), ([x, y, z]) => `${x},${y},${z}`).sort();
}

function makeMinimalMap(
  data: number[] | string = [1, 2, 0, 3],
  overrides: Partial<TiledMap> = {}
): TiledMap {
  return {
    version: "1.10",
    infinite: false,
    orientation: "orthogonal",
    nextlayerid: 2,
    nextobjectid: 1,
    width: 2,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [{
      firstgid: 1,
      name: "terrain",
      tilecount: 4,
      columns: 2,
      tilewidth: 16,
      tileheight: 16,
      source: "terrain.tsx"
    }],
    layers: [{
      type: "tilelayer",
      id: 1,
      name: "Ground",
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      data,
      width: 2,
      height: 2
    }],
    ...overrides
  };
}

describe("TiledConverter.convert — output structure", () => {
  const converter = new TiledConverter();

  it("output version is the current world version", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.world.version, VOXEL_WORLD_VERSION);
  });

  it("chunkSize defaults to 16", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.world.chunkSize, 16);
  });

  it("chunkSize is respected when provided", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc, chunkSize: 8 });
    assert.equal(result.world.chunkSize, 8);
  });

  it("blocksets array has one entry with the correct id and src", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.world.blocksets.length, 1);
    assert.equal(result.world.blocksets[0].id, "terrain");
    assert.equal(result.world.blocksets[0].src, "/assets/terrain.png");
  });

  it("one VoxelLayerJSON per tile layer", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.world.layers.length, 1);
    assert.equal(result.world.layers[0].name, "Ground");
  });

  it("blocks array has one entry per unique non-zero tile", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.blocks.length, 3);
  });

  it("block IDs start at 1", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    const ids = result.blocks.map((b) => b.id).sort((a, b) => a - b);
    assert.equal(ids[0], 1);
  });

  it("GID=0 (empty tile) is skipped — no voxel at that position", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(voxelKeys(result.world, 0).includes("0,0,1"), false);
  });

  it("non-zero tiles produce voxels at the expected keys", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.deepEqual(voxelKeys(result.world, 0), ["0,0,0", "1,0,0", "1,0,1"]);
  });
});

describe("TiledConverter.convert — layerMode", () => {
  const converter = new TiledConverter();

  it("flat mode places all layers at Y=0", () => {
    const map = makeMinimalMap([1, 0, 0, 0], {
      layers: [
        {
          type: "tilelayer",
          id: 1,
          name: "L0",
          visible: true,
          opacity: 1,
          x: 0,
          y: 0,
          data: [1, 0, 0, 0],
          width: 2,
          height: 2
        },
        {
          type: "tilelayer",
          id: 2,
          name: "L1",
          visible: true,
          opacity: 1,
          x: 0,
          y: 0,
          data: [1, 0, 0, 0],
          width: 2,
          height: 2
        }
      ]
    });

    const result = converter.convert(map, { resolveTilesetSrc: simpleSrc, layerMode: "flat" });
    const y0 = voxelKeys(result.world, 0)[0].split(",")[1];
    const y1 = voxelKeys(result.world, 1)[0].split(",")[1];
    assert.equal(y0, "0");
    assert.equal(y1, "0");
  });

  it("stacked mode places layer N at Y=N", () => {
    const map = makeMinimalMap([1, 0, 0, 0], {
      layers: [
        {
          type: "tilelayer",
          id: 1,
          name: "L0",
          visible: true,
          opacity: 1,
          x: 0,
          y: 0,
          data: [1, 0, 0, 0],
          width: 2,
          height: 2
        },
        {
          type: "tilelayer",
          id: 2,
          name: "L1",
          visible: true,
          opacity: 1,
          x: 0,
          y: 0,
          data: [1, 0, 0, 0],
          width: 2,
          height: 2
        }
      ]
    });

    const result = converter.convert(map, { resolveTilesetSrc: simpleSrc, layerMode: "stacked" });
    const y0 = voxelKeys(result.world, 0)[0].split(",")[1];
    const y1 = voxelKeys(result.world, 1)[0].split(",")[1];
    assert.equal(y0, "0");
    assert.equal(y1, "1");
  });
});

describe("TiledConverter.convert — group layers", () => {
  const converter = new TiledConverter();

  it("tile layers nested in a group are flattened into the output", () => {
    const map = makeMinimalMap(undefined, {
      height: 1,
      tilesets: [{ firstgid: 1, name: "t", tilecount: 4, columns: 2, tilewidth: 16, tileheight: 16 }],
      layers: [{
        type: "group",
        id: 10,
        name: "GroupA",
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        layers: [{
          type: "tilelayer",
          id: 1,
          name: "Nested",
          visible: true,
          opacity: 1,
          x: 0,
          y: 0,
          data: [1, 2],
          width: 2,
          height: 1
        }]
      }]
    });

    const result = converter.convert(map, { resolveTilesetSrc: simpleSrc });
    assert.equal(result.world.layers.length, 1);
    assert.equal(result.world.layers[0].name, "Nested");
  });
});

describe("TiledConverter.convert — base64 data", () => {
  const converter = new TiledConverter();

  it("decodes base64-encoded GIDs correctly", () => {
    const gids = [1, 0, 2, 3];
    const base64 = Buffer.from(new Uint32Array(gids).buffer).toString("base64");

    const map = makeMinimalMap(base64);
    const result = converter.convert(map, { resolveTilesetSrc: simpleSrc });

    assert.deepEqual(voxelKeys(result.world, 0), ["0,0,0", "0,0,1", "1,0,1"]);
  });
});
