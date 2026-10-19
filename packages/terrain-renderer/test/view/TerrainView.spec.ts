// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  ChunkCoord,
  DEFAULT_WALKABLE_SLOPE,
  MAX_WALKABLE_SLOPE,
  NODE_DATA_ATTRIBUTE,
  NODE_MORPH_ATTRIBUTE,
  LodRanges,
  NODE_RESOLUTION,
  TerrainDocument,
  TerrainView
} from "#src/index.ts";

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
): TerrainDocument {
  const terrain = new TerrainDocument();
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

    assert.ok(selected.some((node) => node.size !== ranges.nodeSize(node.level)));
    assert.equal(
      nodes.geometry.instanceCount,
      selected.filter((node) => node.size === ranges.nodeSize(node.level)).length
    );
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

  test("nodes behind the camera are culled", () => {
    const view = new TerrainView(stripTerrain(20));
    const selected = view.update(camera({ x: 640, y: 30, z: 32 }, { x: 1280, y: 0, z: 32 }));

    assert.ok(selected.length > 0);
    assert.ok(selected.every((node) => node.x + node.size > 600));
  });

  test("more nodes than the initial capacity still all get an instance", () => {
    const terrain = new TerrainDocument();
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
