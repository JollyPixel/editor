// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  CHUNK_SAMPLES,
  ChunkCoord,
  LodRanges,
  QuadtreeSelection,
  SKIRT_EDGES,
  TerrainDocument,
  type SelectedNode
} from "#src/index.ts";

// CONSTANTS
const kProbeStep = 4;

function stripTerrain(
  length: number
): TerrainDocument {
  const terrain = new TerrainDocument();
  for (let x = 0; x < length; x++) {
    terrain.addChunk(new ChunkCoord(x, 0));
  }

  return terrain;
}

function nodesAt(
  nodes: readonly SelectedNode[],
  x: number,
  z: number
): SelectedNode[] {
  return nodes.filter((node) => (
    x >= node.x && x < node.x + node.size &&
    z >= node.z && z < node.z + node.size
  ));
}

function touching(
  left: SelectedNode,
  right: SelectedNode
): boolean {
  const overlapX = Math.min(left.x + left.size, right.x + right.size) - Math.max(left.x, right.x);
  const overlapZ = Math.min(left.z + left.size, right.z + right.size) - Math.max(left.z, right.z);

  return (overlapX === 0 && overlapZ > 0) || (overlapZ === 0 && overlapX > 0);
}

function acrossEdge(
  node: SelectedNode,
  other: SelectedNode,
  [outX, outZ]: readonly [number, number]
): boolean {
  const overlapX = Math.min(node.x + node.size, other.x + other.size) -
    Math.max(node.x, other.x);
  const overlapZ = Math.min(node.z + node.size, other.z + other.size) -
    Math.max(node.z, other.z);
  if (outX === 0) {
    const touches = outZ < 0 ? other.z + other.size === node.z : other.z === node.z + node.size;

    return touches && overlapX > 0;
  }
  const touches = outX < 0 ? other.x + other.size === node.x : other.x === node.x + node.size;

  return touches && overlapZ > 0;
}

describe("QuadtreeSelection", () => {
  test("every point of a chunk in range is drawn by exactly one node", () => {
    const terrain = stripTerrain(20);
    const nodes = new QuadtreeSelection(terrain).select({ x: 10, y: 20, z: 30 });

    for (const { coord } of terrain.chunks()) {
      const origin = coord.originSample;
      for (let z = origin.z + 1; z < origin.z + CHUNK_SAMPLES; z += kProbeStep) {
        for (let x = origin.x + 1; x < origin.x + CHUNK_SAMPLES; x += kProbeStep) {
          assert.equal(nodesAt(nodes, x, z).length, 1, `point (${x}, ${z})`);
        }
      }
    }
  });

  test("the node under the camera is a leaf and far nodes are coarse", () => {
    const nodes = new QuadtreeSelection(stripTerrain(20)).select({ x: 10, y: 20, z: 30 });

    assert.equal(nodesAt(nodes, 10, 30)[0].level, 0);
    assert.ok(nodesAt(nodes, 1200, 30)[0].level >= 3);
  });

  test("neighbouring nodes differ by at most one level", () => {
    const terrain = stripTerrain(20);
    for (let x = 0; x < 3; x++) {
      terrain.addChunk(new ChunkCoord(x, 1));
      terrain.addChunk(new ChunkCoord(x, -1));
    }
    const selection = new QuadtreeSelection(terrain);

    for (const camera of [{ x: 10, y: 20, z: 30 }, { x: 700, y: 5, z: 60 }, { x: 95, y: 150, z: -20 }]) {
      const nodes = selection.select(camera);
      for (const left of nodes) {
        for (const right of nodes) {
          if (touching(left, right)) {
            assert.ok(
              Math.abs(left.level - right.level) <= 1,
              `levels ${left.level} and ${right.level} meet at (${left.x}, ${left.z})`
            );
          }
        }
      }
    }
  });

  test("a node has a skirt exactly on the edges facing another level", () => {
    const terrain = stripTerrain(20);
    for (let x = 0; x < 3; x++) {
      terrain.addChunk(new ChunkCoord(x, 1));
      terrain.addChunk(new ChunkCoord(x, -1));
    }
    const selection = new QuadtreeSelection(terrain);
    let skirted = 0;
    let bare = 0;

    for (const camera of [{ x: 10, y: 20, z: 30 }, { x: 700, y: 5, z: 60 }, { x: 95, y: 150, z: -20 }]) {
      const nodes = selection.select(camera);
      for (const node of nodes) {
        for (const { bit, outward } of SKIRT_EDGES) {
          const expected = nodes.some(
            (other) => other.level !== node.level && acrossEdge(node, other, outward)
          );
          assert.equal(
            (node.skirts & bit) !== 0,
            expected,
            `edge ${bit} of the node at (${node.x}, ${node.z})`
          );
          if (expected) {
            skirted++;
          }
          else {
            bare++;
          }
        }
      }
    }

    assert.ok(skirted > 0 && bare > 0);
  });

  test("chunks beyond the coarsest range are not drawn", () => {
    const terrain = new TerrainDocument();
    terrain.addChunk(new ChunkCoord(0, 0));
    terrain.addChunk(new ChunkCoord(100, 0));
    const ranges = new LodRanges();
    const nodes = new QuadtreeSelection(terrain, ranges).select({ x: 0, y: 0, z: 0 });

    assert.ok(100 * CHUNK_SAMPLES > ranges.range(ranges.rootLevel));
    assert.ok(nodes.length > 0);
    assert.ok(nodes.every((node) => node.x < CHUNK_SAMPLES));
  });

  test("a culled node is not drawn", () => {
    const nodes = new QuadtreeSelection(stripTerrain(20)).select(
      { x: 10, y: 20, z: 30 },
      { visible: (bounds) => bounds.min.x < 512 }
    );

    assert.ok(nodes.length > 0);
    assert.ok(nodes.every((node) => node.x < 512));
  });

  test("a camera close to a raised chunk sees leaves over it", () => {
    const terrain = stripTerrain(4);
    terrain.removeChunk(new ChunkCoord(2, 0));
    terrain.addChunk(new ChunkCoord(2, 0), new Float32Array(CHUNK_SAMPLE_COUNT).fill(600));
    const nodes = new QuadtreeSelection(terrain).select({ x: 150, y: 601, z: 30 });

    assert.equal(nodesAt(nodes, 150, 30)[0].level, 0);
  });
});

describe("LodRanges", () => {
  test("each level morphs within its own band, ending at its range", () => {
    const ranges = new LodRanges();
    for (let level = 1; level <= ranges.rootLevel; level++) {
      assert.ok(ranges.morphStart(level) > ranges.morphEnd(level - 1));
      assert.ok(ranges.morphStart(level) < ranges.morphEnd(level));
      assert.equal(ranges.morphEnd(level), ranges.range(level));
    }
  });

  test("rejects a leaf range under two leaves or a morph ratio outside (0, 1)", () => {
    assert.throws(() => new LodRanges({ leafRange: 40 }), RangeError);
    assert.throws(() => new LodRanges({ morphRatio: 0 }), RangeError);
    assert.throws(() => new LodRanges({ morphRatio: 1 }), RangeError);
  });
});
