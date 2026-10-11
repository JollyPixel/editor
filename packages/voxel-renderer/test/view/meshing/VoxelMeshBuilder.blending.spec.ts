// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeBlockDef } from "../../helpers/blocks.ts";
import {
  buildChunk,
  makeMeshFixture,
  place,
  type MeshFixture,
  type Vec3Tuple
} from "../../helpers/meshFixture.ts";
import { blendedFaces } from "../../helpers/pulledFaces.ts";
import { CUBE_ID } from "../../helpers/ids.ts";
import type { BlendGroupJSON } from "../../../src/document/materials/index.ts";
import { BLEND_PATTERN_CODES } from "../../../src/view/meshing/index.ts";

// CONSTANTS
const kGrass = 10;
const kDirt = 11;
const kMoss = 12;
const kUngrouped = 13;
const kUnknownGroup = 14;
const kTiles: Record<number, [col: number, row: number]> = {
  [kGrass]: [1, 0],
  [kDirt]: [2, 0],
  [kMoss]: [3, 0]
};
const kUnorm16 = 65535;
const kOffsetNames = ["+x", "-x", "+z", "-z", "+x+z", "+x-z", "-x+z", "-x-z"];

interface ExpectedNeighbour {
  block: number;
  strength: number;
}

type FaceSide = "top" | "bottom";

interface BlendCase {
  name: string;
  groups?: BlendGroupJSON[];
  voxels: [Vec3Tuple, number][];
  expected: Record<string, Record<string, ExpectedNeighbour>>;
}

function makeFixture(
  groups: BlendGroupJSON[] = [
    { id: "grass", width: 3 },
    { id: "dirt", pattern: "bayer" }
  ]
): MeshFixture {
  return makeMeshFixture({
    chunkSize: 8,
    blendGroups: groups,
    blocks: [
      blendBlock(kGrass, "grass"),
      blendBlock(kDirt, "dirt"),
      blendBlock(kMoss, "grass"),
      makeBlockDef(kUngrouped, "cube"),
      makeBlockDef(kUnknownGroup, "cube", { blendGroup: "unknown" })
    ]
  });
}

function blendBlock(
  id: number,
  blendGroup: string
): ReturnType<typeof makeBlockDef> {
  const [col, row] = kTiles[id];

  return makeBlockDef(id, "cube", {
    defaultTexture: { col, row },
    blendGroup
  });
}

function blendSummary(
  fixture: MeshFixture
): Record<string, Record<string, { region: number[]; strength: number; }>> {
  const summary: Record<string, Record<string, { region: number[]; strength: number; }>> = {};
  for (const [key, geometry] of buildChunk(fixture)) {
    if (!key.blended) {
      continue;
    }
    for (const face of blendedFaces(geometry)) {
      const side: FaceSide = face.normalY > 0 ? "top" : "bottom";
      const neighbours: Record<string, { region: number[]; strength: number; }> = {};
      face.neighbours.forEach((entry, index) => {
        if (entry !== null) {
          neighbours[kOffsetNames[index]] = {
            region: entry.region,
            strength: entry.strength
          };
        }
      });
      summary[`${face.cell.join(",")}:${side}`] = neighbours;
    }
  }

  return summary;
}

function regionOf(
  fixture: MeshFixture,
  blockId: number
): number[] {
  const [col, row] = kTiles[blockId];
  const region = fixture.atlases.requireLoadedAtlas().computeTileUvRegion(col, row);

  return [region.offsetU, region.offsetV, region.scaleU, region.scaleV]
    .map((value) => Math.round(Math.fround(value) * kUnorm16));
}

function both(
  cell: string,
  neighbours: Record<string, ExpectedNeighbour>
): Record<string, Record<string, ExpectedNeighbour>> {
  return {
    [`${cell}:top`]: neighbours,
    [`${cell}:bottom`]: neighbours
  };
}

const kCases: BlendCase[] = [
  {
    name: "shares the edge between two equal groups on top and bottom faces",
    voxels: [[[0, 0, 0], kGrass], [[1, 0, 0], kDirt]],
    expected: {
      ...both("0,0,0", { "+x": { block: kDirt, strength: 0.5 } }),
      ...both("1,0,0", { "-x": { block: kGrass, strength: 0.5 } })
    }
  },
  {
    name: "reaches a neighbour across a corner only",
    voxels: [[[0, 0, 0], kGrass], [[1, 0, 1], kDirt]],
    expected: {
      ...both("0,0,0", { "+x+z": { block: kDirt, strength: 0.5 } }),
      ...both("1,0,1", { "-x-z": { block: kGrass, strength: 0.5 } })
    }
  },
  {
    name: "keeps blocks of one group apart",
    voxels: [[[0, 0, 0], kGrass], [[1, 0, 0], kMoss]],
    expected: {}
  },
  {
    name: "never blends with an ungrouped block",
    voxels: [[[0, 0, 0], kGrass], [[1, 0, 0], kUngrouped]],
    expected: {}
  },
  {
    name: "never blends with a block naming an unknown group",
    voxels: [[[0, 0, 0], kGrass], [[1, 0, 0], kUnknownGroup]],
    expected: {}
  },
  {
    name: "honours an exclusion",
    groups: [{ id: "grass", exclude: ["dirt"] }, { id: "dirt" }],
    voxels: [[[0, 0, 0], kGrass], [[1, 0, 0], kDirt]],
    expected: {}
  },
  {
    name: "lets the higher priority cover the lower one only",
    groups: [{ id: "grass", priority: 1 }, { id: "dirt" }],
    voxels: [[[0, 0, 0], kGrass], [[1, 0, 0], kDirt]],
    expected: both("1,0,0", { "-x": { block: kGrass, strength: 1 } })
  },
  {
    name: "ignores a neighbour whose matching face is covered",
    voxels: [
      [[0, 0, 0], kGrass],
      [[1, 0, 0], kDirt],
      [[1, 1, 0], kUngrouped]
    ],
    expected: {
      "0,0,0:bottom": { "+x": { block: kDirt, strength: 0.5 } },
      "1,0,0:bottom": { "-x": { block: kGrass, strength: 0.5 } }
    }
  }
];

describe("VoxelMeshBuilder - tile blending", () => {
  for (const { name, groups, voxels, expected } of kCases) {
    it(name, () => {
      const fixture = makeFixture(groups);
      for (const [position, blockId] of voxels) {
        place(fixture, position, blockId);
      }

      const resolved: Record<string, Record<string, { region: number[]; strength: number; }>> = {};
      for (const [face, neighbours] of Object.entries(expected)) {
        resolved[face] = {};
        for (const [offset, { block, strength }] of Object.entries(neighbours)) {
          resolved[face][offset] = {
            region: regionOf(fixture, block),
            strength
          };
        }
      }

      assert.deepEqual(blendSummary(fixture), resolved);
    });
  }

  it("stores the bleeding group's width, pattern and edge side in the palette", () => {
    const fixture = makeFixture();
    place(fixture, [0, 0, 0], kGrass);
    place(fixture, [1, 0, 0], kDirt);

    const entries = [...buildChunk(fixture)]
      .filter(([key]) => key.blended)
      .flatMap(([, geometry]) => blendedFaces(geometry))
      .flatMap((face) => face.neighbours)
      .filter((entry) => entry !== null)
      .map(({ width, pattern, inverted }) => `${width}:${pattern}:${inverted}`);

    assert.deepEqual(new Set(entries), new Set([
      `8:${BLEND_PATTERN_CODES.bayer}:false`,
      `3:${BLEND_PATTERN_CODES.noise}:true`
    ]));
  });

  it("keeps side faces and unblended top faces in the plain geometry", () => {
    const fixture = makeFixture();
    place(fixture, [0, 0, 0], kGrass);
    place(fixture, [1, 0, 0], kDirt);
    place(fixture, [5, 0, 5], CUBE_ID);

    let plain = 0;
    let blended = 0;
    for (const [key, geometry] of buildChunk(fixture)) {
      if (key.blended) {
        blended += geometry.faceCount;
      }
      else {
        plain += geometry.faceCount;
      }
    }

    assert.equal(blended, 4);
    assert.equal(plain, 3 + 3 + 6);
  });

  it("reads face corners through the four-word layout", () => {
    const fixture = makeFixture();
    place(fixture, [0, 0, 0], kGrass);
    place(fixture, [1, 0, 0], kDirt);
    const [geometry] = [...buildChunk(fixture)]
      .filter(([key]) => key.blended)
      .map(([, blended]) => blended);

    const positions = geometry.toIndexedGeometry().getAttribute("position");
    const ys = new Set<number>();
    for (let i = 0; i < positions.count; i++) {
      ys.add(positions.getY(i));
      assert.ok(positions.getX(i) >= 0 && positions.getX(i) <= 2);
      assert.ok(positions.getZ(i) >= 0 && positions.getZ(i) <= 1);
    }

    assert.deepEqual([...ys].sort(), [0, 1]);
  });
});
