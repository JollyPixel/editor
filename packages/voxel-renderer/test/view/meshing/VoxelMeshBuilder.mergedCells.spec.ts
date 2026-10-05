// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeBlockDef } from "../../helpers/blocks.ts";
import {
  countChunkVertices,
  makeMeshFixture,
  place,
  type MeshFixture,
  type Vec3Tuple
} from "../../helpers/meshFixture.ts";
import {
  CUBE_ID as kCubeId,
  RAMP_ID as kRampId
} from "../../helpers/ids.ts";
import { VoxelTransform } from "../../../src/document/geometry/index.ts";

interface MergedCase {
  name: string;
  partner: number;
  neighbour?: Vec3Tuple;
  faces: number;
}

// CONSTANTS
const kSlabBottomId = 10;
const kSlabTopId = 11;
const kGlassTopId = 12;
const kOrigin: Vec3Tuple = [1, 1, 1];
const kCases: MergedCase[] = [
  {
    name: "drops the inner faces of an opaque pair",
    partner: kSlabTopId,
    faces: 10
  },
  {
    name: "keeps the inner face seen through a blended half",
    partner: kGlassTopId,
    faces: 11
  },
  {
    name: "keeps every face of a pair that does not fill the cell",
    partner: kRampId,
    faces: 6 + 5
  },
  {
    name: "hides a neighbour face behind an opaque pair",
    partner: kSlabTopId,
    neighbour: [2, 1, 1],
    faces: 10 - 2 + 5
  },
  {
    name: "shows a neighbour face behind a blended half",
    partner: kGlassTopId,
    neighbour: [2, 1, 1],
    faces: 11 - 1 + 6
  }
];

function makeFixture(): MeshFixture {
  return makeMeshFixture({
    blocks: [
      makeBlockDef(kSlabBottomId, "slabBottom"),
      makeBlockDef(kSlabTopId, "slabTop"),
      makeBlockDef(kGlassTopId, "slabTop", { alphaMode: "blend" })
    ]
  });
}

describe("VoxelMeshBuilder - merged cells", () => {
  for (const { name, partner, neighbour, faces } of kCases) {
    it(name, () => {
      const fixture = makeFixture();
      const [x, y, z] = kOrigin;
      fixture.layer.setVoxelAt({ x, y, z }, {
        blockId: kSlabBottomId,
        transform: 0,
        partner: {
          blockId: partner,
          transform: 0
        }
      });
      if (neighbour !== undefined) {
        place(fixture, neighbour, kCubeId);
      }

      assert.equal(countChunkVertices(fixture), faces * 4);
    });
  }

  it("drops the shared slope of two ramps turned together", () => {
    const fixture = makeFixture();
    const turned = new VoxelTransform({ rotation: 1 });
    const upsideDown = new VoxelTransform({ rotation: 2, flipY: true });
    fixture.layer.setVoxelAt({ x: 1, y: 1, z: 1 }, {
      blockId: kRampId,
      transform: turned.packed,
      partner: {
        blockId: kRampId,
        transform: upsideDown.followedBy(turned).packed
      }
    });

    assert.equal(countChunkVertices(fixture), (5 + 5 - 2) * 4);
  });
});
