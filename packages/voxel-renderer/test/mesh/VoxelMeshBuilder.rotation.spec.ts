// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelTransform } from "../../src/world/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  countChunkVertices,
  makeMeshFixture,
  place,
  type MeshFixture,
  type Vec3Tuple
} from "../helpers/meshFixture.ts";
import {
  CUBE_ID as kCubeId,
  RAMP_ID as kRampId,
  STAIR_ID as kStairId
} from "../helpers/ids.ts";

// CONSTANTS
const kSlabBottomId = 6;
const kSlabTopId = 7;
const kPoleYId = 8;

interface NeighbourCase {
  name: string;
  voxels: [Vec3Tuple, number, number?][];
  vertices: number;
  culledFaces?: number;
}

function rotated(
  rotation: number
): number {
  return new VoxelTransform({ rotation }).packed;
}

function makeFixture(): MeshFixture {
  const fixture = makeMeshFixture();
  fixture.blockRegistry.register(makeBlockDef(kSlabBottomId, "slabBottom"));
  fixture.blockRegistry.register(makeBlockDef(kSlabTopId, "slabTop"));
  fixture.blockRegistry.register(makeBlockDef(kPoleYId, "poleY"));

  return fixture;
}

const kRotatedNeighbours: NeighbourCase[] = [
  {
    name: "a ramp back wall turned by rot=2 hides the cube face it touches",
    voxels: [[[0, 0, 0], kCubeId], [[0, 0, 1], kRampId, rotated(2)]],
    vertices: 36
  },
  {
    name: "a ramp open front leaves the cube face it faces visible",
    voxels: [[[0, 0, 0], kCubeId], [[0, 0, 1], kRampId, rotated(0)]],
    vertices: 44
  },
  {
    name: "a ramp turned by rot=1 shows its open front to a cube on -X",
    voxels: [[[0, 0, 0], kCubeId], [[1, 0, 0], kRampId, rotated(1)]],
    vertices: 44
  },
  {
    name: "a ramp turned by rot=3 shows its back wall to a cube on -X",
    voxels: [[[0, 0, 0], kCubeId], [[1, 0, 0], kRampId, rotated(3)]],
    vertices: 36
  },
  {
    name: "a stair turned by rot=1 shows its partial front to a cube on -X",
    voxels: [[[0, 0, 0], kCubeId], [[1, 0, 0], kStairId, rotated(1)]],
    vertices: 60
  },
  {
    name: "a ramp turned by rot=1 shows its back wall to a cube on +X",
    voxels: [[[0, 0, 0], kCubeId], [[-1, 0, 0], kRampId, rotated(1)]],
    vertices: 20
  }
];

const kUntouchedFaces: NeighbourCase[] = [
  {
    name: "keeps the ramp slope under a cube",
    voxels: [[[0, 0, 0], kRampId], [[0, 1, 0], kCubeId]],
    vertices: 44,
    culledFaces: 0
  },
  {
    name: "keeps a bottom slab's top face under a cube",
    voxels: [[[0, 0, 0], kSlabBottomId], [[0, 1, 0], kCubeId]],
    vertices: 48,
    culledFaces: 0
  },
  {
    name: "keeps a top slab's bottom face above a cube",
    voxels: [[[0, 0, 0], kCubeId], [[0, 1, 0], kSlabTopId]],
    vertices: 48,
    culledFaces: 0
  },
  {
    name: "keeps a stair's lower tread under a cube but culls the upper one",
    voxels: [[[0, 0, 0], kStairId], [[0, 1, 0], kCubeId]],
    vertices: 60,
    culledFaces: 1
  },
  {
    name: "keeps a pole's side faces beside a cube",
    voxels: [[[0, 0, 0], kPoleYId], [[1, 0, 0], kCubeId]],
    vertices: 48,
    culledFaces: 0
  }
];

function describeCases(
  title: string,
  cases: NeighbourCase[]
): void {
  describe(title, () => {
    for (const { name, voxels, vertices, culledFaces } of cases) {
      it(name, () => {
        const fixture = makeFixture();
        for (const [position, blockId, transform] of voxels) {
          place(fixture, position, blockId, transform);
        }

        assert.equal(countChunkVertices(fixture), vertices);
        if (culledFaces !== undefined) {
          assert.equal(fixture.builder.stats.culledFaces, culledFaces);
        }
      });
    }
  });
}

describeCases(
  "VoxelMeshBuilder - a rotated neighbour occludes through its world face",
  kRotatedNeighbours
);
describeCases(
  "VoxelMeshBuilder - a neighbour never hides a face it does not touch",
  kUntouchedFaces
);
