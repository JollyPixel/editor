// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import {
  TILE_SAMPLE_COUNT,
  TileCoord,
  TILES_PER_CHUNK
} from "#src/terrain/TileCoord.ts";
import { LodRanges } from "#src/view/lod/LodRanges.ts";
import {
  DEFAULT_WALKABLE_SLOPE,
  MAX_WALKABLE_SLOPE,
  NODE_DATA_ATTRIBUTE,
  NODE_MORPH_ATTRIBUTE
} from "#src/view/shading/terrainNodes.ts";
import {
  NODE_RESOLUTION,
  TerrainView
} from "#src/view/TerrainView.ts";

type BatchMesh = THREE.Mesh<THREE.InstancedBufferGeometry>;

function camera(
  position: THREE.Vector3Like,
  target: THREE.Vector3Like,
  fov = 60
): THREE.PerspectiveCamera {
  const result = new THREE.PerspectiveCamera(fov, 1, 0.1, 10_000);
  result.position.copy(position);
  result.lookAt(target.x, target.y, target.z);

  return result;
}

function stripTerrain(
  length: number
): Terrain {
  const terrain = new Terrain();
  for (let x = 0; x < length; x++) {
    terrain.addChunk(new ChunkCoord(x, 0));
  }

  return terrain;
}

function batches(
  view: TerrainView
): BatchMesh[] {
  return view.root.children as BatchMesh[];
}

describe("TerrainView", () => {
  test("every selected node becomes one instance of the full or quarter mesh", () => {
    const view = new TerrainView(stripTerrain(20));
    const selected = view.update(camera({ x: 10, y: 30, z: -40 }, { x: 600, y: 0, z: 32 }));
    const [nodes, quarters] = batches(view);
    const { ranges } = view.selection;

    const full = selected.filter((node) => node.size === ranges.nodeSize(node.level));
    const quarter = selected.filter((node) => node.size === ranges.nodeSize(node.level) / 2);

    assert.ok(quarter.length > 0);
    assert.equal(full.length + quarter.length, selected.length);
    assert.equal(nodes.geometry.instanceCount, full.length);
    assert.equal(nodes.geometry.instanceCount + quarters.geometry.instanceCount, selected.length);
  });

  test("an instance carries its corner, grid spacing, skirt depth, morph band and skirt edges", () => {
    const view = new TerrainView(stripTerrain(20));
    const selected = view.update(camera({ x: 10, y: 30, z: -40 }, { x: 600, y: 0, z: 32 }));
    const [nodes] = batches(view);
    const { ranges } = view.selection;
    const first = selected.find((node) => node.size === ranges.nodeSize(node.level))!;
    const spacing = ranges.nodeSize(first.level) / NODE_RESOLUTION;
    const data = nodes.geometry.getAttribute(NODE_DATA_ATTRIBUTE);
    const morph = nodes.geometry.getAttribute(NODE_MORPH_ATTRIBUTE);

    assert.deepEqual(
      [data.getX(0), data.getY(0), data.getZ(0), data.getW(0)],
      [first.x, first.z, spacing, spacing]
    );
    assert.deepEqual(
      [morph.getX(0), morph.getY(0), morph.getZ(0)],
      [ranges.morphStart(first.level), ranges.morphEnd(first.level), first.skirts].map(Math.fround)
    );
  });

  test("tiles raised after a frame refine the nodes over them on the next frame", () => {
    const terrain = stripTerrain(4);
    const view = new TerrainView(terrain);
    const eye = camera({ x: 150, y: 601, z: 30 }, { x: 150, y: 0, z: 31 });
    view.update(eye);

    const chunk = new ChunkCoord(2, 0);
    const tiles = Array.from(
      { length: TILES_PER_CHUNK ** 2 },
      (_, index) => TileCoord.fromIndex(chunk, index)
    );
    for (const tile of tiles) {
      terrain.writeTile(tile, new Float32Array(TILE_SAMPLE_COUNT).fill(600));
    }
    view.tilesChanged(tiles);
    const under = view.update(eye).filter((node) => node.x <= 150 && node.x + node.size > 150);

    assert.deepEqual(under.map(({ level }) => level), [0]);
  });

  test("nodes behind the camera are culled", () => {
    const view = new TerrainView(stripTerrain(20));
    const selected = view.update(camera({ x: 640, y: 30, z: 32 }, { x: 1280, y: 0, z: 32 }));

    assert.ok(selected.length > 0);
    assert.ok(selected.every((node) => node.x + node.size > 600));
  });

  test("more nodes than the initial capacity still all get an instance", () => {
    const terrain = new Terrain();
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        terrain.addChunk(new ChunkCoord(x, z));
      }
    }
    const view = new TerrainView(terrain, { ranges: new LodRanges({ leafRange: 300 }) });
    const selected = view.update(camera({ x: 512, y: 300, z: 512 }, { x: 512, y: 0, z: 512.1 }, 170));
    const [nodes, quarters] = batches(view);

    assert.ok(selected.length > 64);
    assert.equal(nodes.geometry.instanceCount + quarters.geometry.instanceCount, selected.length);
  });

  test("the walkable slope starts at its default, stays within its bounds and redraws on change", () => {
    let frames = 0;
    const view = new TerrainView(stripTerrain(1), { requestFrame: () => frames++ });
    frames = 0;
    const slopes = [DEFAULT_WALKABLE_SLOPE];
    for (const degrees of [30, -10, 120, Number.NaN]) {
      view.walkableSlope = degrees;
      slopes.push(view.walkableSlope);
    }

    assert.deepEqual(slopes, [DEFAULT_WALKABLE_SLOPE, 30, 0, MAX_WALKABLE_SLOPE, DEFAULT_WALKABLE_SLOPE]);
    assert.equal(frames, 4);
  });
});
