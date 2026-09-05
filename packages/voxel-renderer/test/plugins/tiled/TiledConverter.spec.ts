// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TiledConverter, type TiledMap } from "../../../src/plugins/tiled/index.ts";

// Simple resolver that returns the tileset name as the src path
function simpleSrc(_src: string, id: string) {
  return `/assets/${id}.png`;
}

// Minimal 2×2 tile map with a single tileset (4 tiles: 2 cols, 2 rows)
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

  it("output version is 1", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.version, 1);
  });

  it("chunkSize defaults to 16", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.chunkSize, 16);
  });

  it("chunkSize is respected when provided", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc, chunkSize: 8 });
    assert.equal(result.chunkSize, 8);
  });

  it("tilesets array has one entry with the correct id and src", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.tilesets.length, 1);
    assert.equal(result.tilesets[0].id, "terrain");
    assert.equal(result.tilesets[0].src, "/assets/terrain.png");
  });

  it("one VoxelLayerJSON per tile layer", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.layers.length, 1);
    assert.equal(result.layers[0].name, "Ground");
  });

  it("blocks array has one entry per unique non-zero tile", () => {
    // data=[1,2,0,3]: 3 unique non-zero tiles → 3 blocks
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.ok(result.blocks !== undefined);
    assert.equal(result.blocks!.length, 3);
  });

  it("block IDs start at 1", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    const ids = result.blocks!.map((b) => b.id).sort((a, b) => a - b);
    assert.equal(ids[0], 1);
  });

  it("GID=0 (empty tile) is skipped — no voxel at that position", () => {
    // data=[1,2,0,3]: position (col=0,row=1) = key "0,0,1" is the zero GID → skipped
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    const voxels = result.layers[0].voxels;
    assert.equal(voxels["0,0,1"], undefined);
  });

  it("non-zero tiles produce voxels at the expected keys", () => {
    // 2-wide map: col=i%2, row=floor(i/2). layerMode=flat → Y=0
    // i=0: GID=1, key "0,0,0"; i=1: GID=2, key "1,0,0"; i=3: GID=3, key "1,0,1"
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    const voxels = result.layers[0].voxels;
    assert.ok("0,0,0" in voxels, "expected voxel at 0,0,0");
    assert.ok("1,0,0" in voxels, "expected voxel at 1,0,0");
    assert.ok("1,0,1" in voxels, "expected voxel at 1,0,1");
  });
});

describe("TiledConverter.convert — layerMode", () => {
  const converter = new TiledConverter();

  it("flat mode places all layers at Y=0", () => {
    const map = makeMinimalMap([1, 0, 0, 0], {
      layers: [
        {
          type: "tilelayer", id: 1, name: "L0", visible: true, opacity: 1, x: 0, y: 0, data: [1, 0, 0, 0], width: 2, height: 2
        },
        {
          type: "tilelayer", id: 2, name: "L1", visible: true, opacity: 1, x: 0, y: 0, data: [1, 0, 0, 0], width: 2, height: 2
        }
      ]
    });

    const result = converter.convert(map, { resolveTilesetSrc: simpleSrc, layerMode: "flat" });
    const y0 = Object.keys(result.layers[0].voxels)[0].split(",")[1];
    const y1 = Object.keys(result.layers[1].voxels)[0].split(",")[1];
    assert.equal(y0, "0");
    assert.equal(y1, "0");
  });

  it("stacked mode places layer N at Y=N", () => {
    const map = makeMinimalMap([1, 0, 0, 0], {
      layers: [
        {
          type: "tilelayer", id: 1, name: "L0", visible: true, opacity: 1, x: 0, y: 0, data: [1, 0, 0, 0], width: 2, height: 2
        },
        {
          type: "tilelayer", id: 2, name: "L1", visible: true, opacity: 1, x: 0, y: 0, data: [1, 0, 0, 0], width: 2, height: 2
        }
      ]
    });

    const result = converter.convert(map, { resolveTilesetSrc: simpleSrc, layerMode: "stacked" });
    const y0 = Object.keys(result.layers[0].voxels)[0].split(",")[1];
    const y1 = Object.keys(result.layers[1].voxels)[0].split(",")[1];
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
    assert.equal(result.layers.length, 1);
    assert.equal(result.layers[0].name, "Nested");
  });
});

describe("TiledConverter.convert — base64 data", () => {
  const converter = new TiledConverter();

  it("decodes base64-encoded GIDs correctly", () => {
    // Build a base64 string for data [1, 0, 2, 3] (4 little-endian uint32 values)
    const gids = [1, 0, 2, 3];
    const base64 = Buffer.from(new Uint32Array(gids).buffer).toString("base64");

    const map = makeMinimalMap(base64);
    const result = converter.convert(map, { resolveTilesetSrc: simpleSrc });

    // GID=1 → key "0,0,0"; GID=2 → key "0,0,1"; GID=3 → key "1,0,1"; GID=0 skipped
    const voxels = result.layers[0].voxels;
    assert.ok("0,0,0" in voxels, "GID=1 should produce voxel at 0,0,0");
    assert.ok("0,0,1" in voxels, "GID=2 should produce voxel at 0,0,1");
    assert.ok("1,0,1" in voxels, "GID=3 should produce voxel at 1,0,1");
    assert.equal(voxels["1,0,0"], undefined, "GID=0 (empty) should have no voxel");
  });
});

describe("TiledConverter.convert — error paths", () => {
  const converter = new TiledConverter();

  it("throws for infinite (chunked) maps", () => {
    const map = makeMinimalMap([], {
      width: 0,
      height: 0,
      tilesets: [],
      layers: [{
        type: "tilelayer",
        id: 1,
        name: "Infinite",
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        data: [],
        width: 0,
        height: 0,
        chunks: [{ data: [1], x: 0, y: 0, width: 1, height: 1 }]
      }]
    });

    assert.throws(
      () => converter.convert(map, { resolveTilesetSrc: simpleSrc }),
      /infinite maps are not supported/
    );
  });

  it("throws for compressed data", () => {
    const map = makeMinimalMap("abc", {
      tilesets: [],
      layers: [{
        type: "tilelayer",
        id: 1,
        name: "Compressed",
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        data: "abc",
        width: 2,
        height: 2,
        compression: "zlib"
      }]
    });

    assert.throws(
      () => converter.convert(map, { resolveTilesetSrc: simpleSrc }),
      /compressed tile data/
    );
  });
});

describe("TiledConverter.convert — object layers", () => {
  const converter = new TiledConverter();

  function makeObjectMap(
    size: { width: number; height: number; }
  ) {
    return makeMinimalMap(undefined, {
      width: 10,
      height: 10,
      tilesets: [],
      layers: [{
        type: "objectgroup",
        id: 2,
        name: "Spawns",
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        objects: [{
          id: 1,
          name: "PlayerStart",
          x: 32,
          y: 48,
          width: size.width,
          height: size.height,
          rotation: 0,
          visible: true
        }]
      }]
    });
  }

  it("object layers are included in objectLayers", () => {
    const map = makeMinimalMap(undefined, {
      width: 10,
      height: 10,
      tilesets: [],
      layers: [{
        type: "objectgroup",
        id: 2,
        name: "Spawns",
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        objects: [{
          id: 1,
          name: "PlayerStart",
          x: 32,
          y: 48,
          width: 0,
          height: 0,
          rotation: 0,
          visible: true,
          properties: [{ name: "team", type: "string", value: "blue" }]
        }]
      }]
    });

    const result = converter.convert(map, { resolveTilesetSrc: simpleSrc });
    assert.ok(result.objectLayers !== undefined);
    assert.equal(result.objectLayers!.length, 1);
    assert.equal(result.objectLayers![0].name, "Spawns");

    const obj = result.objectLayers![0].objects[0];
    assert.equal(obj.name, "PlayerStart");
    // Pixel→voxel: x=32/16=2, z=48/16=3
    assert.equal(obj.x, 2);
    assert.equal(obj.z, 3);
    assert.equal(obj.properties?.team, "blue");
  });

  it("gives a zero-sized point object a one voxel footprint", () => {
    const result = converter.convert(
      makeObjectMap({ width: 0, height: 0 }),
      { resolveTilesetSrc: simpleSrc }
    );

    const obj = result.objectLayers![0].objects[0];
    assert.equal(obj.width, 1);
    assert.equal(obj.height, 1);
  });

  it("rounds an object that spans a fraction of a tile", () => {
    // 40/16 = 2.5 → 3, 8/16 = 0.5 → 1
    const result = converter.convert(
      makeObjectMap({ width: 40, height: 8 }),
      { resolveTilesetSrc: simpleSrc }
    );

    const obj = result.objectLayers![0].objects[0];
    assert.equal(obj.width, 3);
    assert.equal(obj.height, 1);
  });

  it("keeps a whole-tile footprint as it is", () => {
    const result = converter.convert(
      makeObjectMap({ width: 32, height: 64 }),
      { resolveTilesetSrc: simpleSrc }
    );

    const obj = result.objectLayers![0].objects[0];
    assert.equal(obj.width, 2);
    assert.equal(obj.height, 4);
  });

  it("objectLayers is absent when no object layers exist", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.objectLayers, undefined);
  });
});
