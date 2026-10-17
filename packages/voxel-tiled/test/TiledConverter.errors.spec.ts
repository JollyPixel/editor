// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TiledConverter, type TiledMap } from "../src/index.ts";

function simpleSrc(_src: string, id: string) {
  return `/assets/${id}.png`;
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
    assert.ok(result.world.objectLayers !== undefined);
    assert.equal(result.world.objectLayers!.length, 1);
    assert.equal(result.world.objectLayers![0].name, "Spawns");

    const obj = result.world.objectLayers![0].objects[0];
    assert.equal(obj.name, "PlayerStart");
    assert.equal(obj.x, 2);
    assert.equal(obj.z, 3);
    assert.equal(obj.properties?.team, "blue");
  });

  it("gives a zero-sized point object a one voxel footprint", () => {
    const result = converter.convert(
      makeObjectMap({ width: 0, height: 0 }),
      { resolveTilesetSrc: simpleSrc }
    );

    const obj = result.world.objectLayers![0].objects[0];
    assert.equal(obj.width, 1);
    assert.equal(obj.height, 1);
  });

  it("rounds an object that spans a fraction of a tile", () => {
    const result = converter.convert(
      makeObjectMap({ width: 40, height: 8 }),
      { resolveTilesetSrc: simpleSrc }
    );

    const obj = result.world.objectLayers![0].objects[0];
    assert.equal(obj.width, 3);
    assert.equal(obj.height, 1);
  });

  it("keeps a whole-tile footprint as it is", () => {
    const result = converter.convert(
      makeObjectMap({ width: 32, height: 64 }),
      { resolveTilesetSrc: simpleSrc }
    );

    const obj = result.world.objectLayers![0].objects[0];
    assert.equal(obj.width, 2);
    assert.equal(obj.height, 4);
  });

  it("objectLayers is absent when no object layers exist", () => {
    const result = converter.convert(makeMinimalMap(), { resolveTilesetSrc: simpleSrc });
    assert.equal(result.world.objectLayers, undefined);
  });
});
