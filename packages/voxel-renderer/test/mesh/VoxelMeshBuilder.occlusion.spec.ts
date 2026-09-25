// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { BlockDefinition } from "../../src/blocks/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  buildGeometries,
  countChunkVertices,
  countLayerVertices,
  geometryAlphaModes,
  makeMeshFixture,
  place,
  type MeshFixture
} from "../helpers/meshFixture.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId,
  RAMP_ID as kRampId,
  STAIR_ID as kStairId
} from "../helpers/ids.ts";
import {
  VoxelTransform,
  type VoxelTransformOptions
} from "../../src/world/index.ts";

// CONSTANTS
const kGrateId = 5;
const kGlassRampId = 6;
const kBlend = { alphaMode: "blend" } as const;

interface PairCase {
  name: string;
  leaves: Partial<BlockDefinition>;
  row: number[];
  greedy?: boolean;
  vertices: number;
  culledFaces: number;
}

const kPairCases: PairCase[] = [
  {
    name: "a blended block keeps the solid face seen through it",
    leaves: { ...kBlend, cullCoveredFaces: true },
    row: [kCubeId, kLeavesId],
    vertices: 44,
    culledFaces: 1
  },
  {
    name: "an opaque block culls the face it covers",
    leaves: { alphaMode: "opaque", cullCoveredFaces: true },
    row: [kCubeId, kLeavesId],
    vertices: 40,
    culledFaces: 2
  },
  {
    name: "a culling blended block drops the face it shares with itself",
    leaves: { ...kBlend, cullCoveredFaces: true },
    row: [kLeavesId, kLeavesId],
    vertices: 40,
    culledFaces: 2
  },
  {
    name: "two different blended blocks keep their shared face",
    leaves: { ...kBlend, cullCoveredFaces: true },
    row: [kLeavesId, kGrateId],
    vertices: 48,
    culledFaces: 0
  },
  {
    name: "a blended block keeps covered faces by default",
    leaves: kBlend,
    row: [kLeavesId, kLeavesId],
    vertices: 48,
    culledFaces: 0
  },
  {
    name: "a blended block keeps covered faces under the greedy mesher",
    leaves: { ...kBlend, cullCoveredFaces: false },
    row: [kLeavesId, kLeavesId],
    greedy: true,
    vertices: 32,
    culledFaces: 0
  },
  {
    name: "a blended run keeps the boundary on both sides of its middle",
    leaves: { ...kBlend, cullCoveredFaces: false },
    row: [kLeavesId, kLeavesId, kLeavesId],
    vertices: 72,
    culledFaces: 0
  },
  {
    name: "a blended block keeps the face an opaque neighbour covers",
    leaves: { ...kBlend, cullCoveredFaces: false },
    row: [kCubeId, kLeavesId],
    vertices: 48,
    culledFaces: 0
  },
  {
    name: "a front-sided blended block hides the face it could never show",
    leaves: { ...kBlend, side: "front", cullCoveredFaces: false },
    row: [kCubeId, kLeavesId],
    vertices: 44,
    culledFaces: 1
  },
  {
    name: "an opaque block that keeps covered faces retains its boundaries",
    leaves: { cullCoveredFaces: false },
    row: [kLeavesId, kLeavesId],
    vertices: 48,
    culledFaces: 0
  }
];

function makeFixture(
  leaves: Partial<BlockDefinition>,
  greedy = false
): MeshFixture {
  const fixture = makeMeshFixture({ greedy });
  fixture.blockRegistry.register(makeBlockDef(kLeavesId, "cube", leaves));
  fixture.blockRegistry.register(
    makeBlockDef(kGrateId, "cube", { ...kBlend, cullCoveredFaces: true })
  );

  return fixture;
}

describe("VoxelMeshBuilder - block transparency and covered faces", () => {
  for (const { name, leaves, row, greedy, vertices, culledFaces } of kPairCases) {
    it(name, () => {
      const fixture = makeFixture(leaves, greedy);
      row.forEach((blockId, x) => place(fixture, [x, 0, 0], blockId));

      assert.equal(countChunkVertices(fixture), vertices);
      assert.equal(fixture.builder.stats.culledFaces, culledFaces);
    });
  }

  for (const greedy of [false, true]) {
    it(`splits blended faces into a cutout geometry (greedy=${greedy})`, () => {
      const fixture = makeFixture({ ...kBlend, cullCoveredFaces: false }, greedy);
      place(fixture, [0, 0, 0]);
      place(fixture, [1, 0, 0], kLeavesId);

      assert.deepEqual(geometryAlphaModes(fixture), ["opaque", "blend"]);
    });
  }

  it("emits a single geometry when no block is transparent", () => {
    const fixture = makeFixture({ alphaMode: "opaque" });
    place(fixture, [0, 0, 0], kLeavesId);

    assert.deepEqual(geometryAlphaModes(fixture), ["opaque"]);
  });

  it("keeps a blended face covered by an opaque voxel of another layer", () => {
    const fixture = makeFixture({ ...kBlend, cullCoveredFaces: false });
    place(fixture.world.addLayer("stone"), [0, 0, 0]);
    place(fixture, [1, 0, 0], kLeavesId);

    assert.deepEqual(geometryAlphaModes(fixture), ["blend"]);
    assert.equal(countChunkVertices(fixture), 24);
  });
});

describe("VoxelMeshBuilder - layer opacity and occlusion", () => {
  it("a neighbour in a translucent layer does not occlude", () => {
    const fixture = makeMeshFixture();
    place(fixture.world.addLayer("glass", { opacity: 0.5 }), [1, 0, 0]);
    place(fixture, [0, 0, 0]);

    assert.equal(countChunkVertices(fixture), 24);
  });

  it("a neighbour in an opaque layer occludes", () => {
    const fixture = makeMeshFixture();
    place(fixture.world.addLayer("solid"), [1, 0, 0]);
    place(fixture, [0, 0, 0]);

    assert.equal(countChunkVertices(fixture), 20);
  });

  it("a translucent layer keeps every face against an opaque neighbour", () => {
    const fixture = makeMeshFixture();
    const glass = fixture.world.addLayer("glass", { opacity: 0.5 });
    place(glass, [0, 0, 0]);
    place(fixture, [1, 0, 0]);

    assert.equal(countLayerVertices(fixture, glass), 24);
  });

  it("a translucent layer still occludes itself", () => {
    const fixture = makeMeshFixture();
    fixture.layer.opacity = 0.5;
    place(fixture, [0, 0, 0]);
    place(fixture, [1, 0, 0]);

    assert.equal(countChunkVertices(fixture), 40);
  });

  it("an opaque neighbour occludes through a translucent voxel sharing its cell", () => {
    const fixture = makeMeshFixture();
    place(fixture.world.addLayer("glass", { opacity: 0.5 }), [1, 0, 0]);
    place(fixture.world.addLayer("stone"), [1, 0, 0]);
    place(fixture, [0, 0, 0]);

    assert.equal(countChunkVertices(fixture), 20);
  });

  it("a translucent layer does not suppress a lower-priority voxel it covers", () => {
    const fixture = makeMeshFixture();
    const glass = fixture.world.addLayer("glass", { opacity: 0.5 });
    place(fixture, [0, 0, 0]);
    place(glass, [0, 0, 0]);

    assert.equal(countLayerVertices(fixture, glass), 24);
    assert.equal(countChunkVertices(fixture), 24);
  });
});

describe("VoxelMeshBuilder - neighbour lookups across chunks and layer positions", () => {
  it("culls against a layer whose offset puts it on another chunk grid", () => {
    const fixture = makeMeshFixture();
    const shifted = fixture.world.addLayer("shifted");
    shifted.position = { x: 2, y: 0, z: 0 };
    place(fixture, [0, 0, 0]);
    place(shifted, [5, 0, 0]);

    assert.equal(countChunkVertices(fixture), 24);

    place(shifted, [1, 0, 0]);

    assert.equal(countChunkVertices(fixture), 20);
  });

  for (const neighbourX of [4, -1]) {
    it(`culls a face against a neighbour one chunk over (x=${neighbourX})`, () => {
      const fixture = makeMeshFixture();
      const x = neighbourX > 0 ? 3 : 0;
      place(fixture, [x, 0, 0]);
      place(fixture, [neighbourX, 0, 0]);

      buildGeometries(fixture);

      assert.equal(fixture.builder.stats.culledFaces, 1);
      assert.equal(fixture.builder.stats.faces, 5);
    });
  }
});

describe("VoxelMeshBuilder - partial boundary faces", () => {
  type Block = [blockId: number, transform?: VoxelTransformOptions];
  const kUpsideDownStair: Block = [kStairId, { flipY: true }];

  const kPartialCases: [string, Block, Block, number][] = [
    ["two ramps cull their shared triangles", [kRampId], [kRampId], 2],
    ["two stairs cull their shared steps", [kStairId], [kStairId], 4],
    ["two upside-down stairs cull their shared steps", kUpsideDownStair, kUpsideDownStair, 4],
    ["a stair culls the ramp triangle it contains", [kStairId], [kRampId], 1],
    ["mirrored ramps keep their partly overlapping triangles", [kRampId, { rotation: 2 }], [kRampId], 0],
    ["a blended ramp does not cull an opaque triangle", [kRampId], [kGlassRampId], 0]
  ];

  for (const greedy of [false, true]) {
    for (const [name, left, right, culledFaces] of kPartialCases) {
      it(`${name} (greedy=${greedy})`, () => {
        const fixture = makeMeshFixture({ greedy });
        fixture.blockRegistry.register(makeBlockDef(kGlassRampId, "ramp", kBlend));
        place(fixture, [0, 0, 0], left[0], new VoxelTransform(left[1]).packed);
        place(fixture, [1, 0, 0], right[0], new VoxelTransform(right[1]).packed);

        buildGeometries(fixture);

        assert.equal(fixture.builder.stats.culledFaces, culledFaces);
      });
    }
  }

  it("culls a flipped stair like the rotation it mirrors", () => {
    const kEquivalents: [VoxelTransformOptions, VoxelTransformOptions][] = [
      [{ flipZ: true }, { rotation: 2 }],
      [{ flipX: true }, {}],
      [{ flipX: true, flipZ: true, flipY: true }, { rotation: 2, flipY: true }]
    ];
    const kNeighbours = [[2, 1, 1], [0, 1, 1], [1, 2, 1], [1, 0, 1], [1, 1, 2], [1, 1, 0]] as const;

    function statsOf(
      transform: VoxelTransformOptions,
      neighbour: readonly [number, number, number]
    ) {
      const fixture = makeMeshFixture();
      place(fixture, [1, 1, 1], kStairId, new VoxelTransform(transform).packed);
      place(fixture, [...neighbour]);
      buildGeometries(fixture);
      const { faces, culledFaces, vertices } = fixture.builder.stats;

      return { faces, culledFaces, vertices };
    }

    for (const [flipped, rotated] of kEquivalents) {
      for (const neighbour of kNeighbours) {
        assert.deepEqual(
          statsOf(flipped, neighbour),
          statsOf(rotated, neighbour),
          `${JSON.stringify(flipped)} next to ${neighbour}`
        );
      }
    }
  });
});
