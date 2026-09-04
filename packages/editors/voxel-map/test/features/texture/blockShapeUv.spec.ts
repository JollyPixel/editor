// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  Face,
  type BlockShape
} from "@jolly-pixel/voxel.renderer";
import { UV_FACES } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blockShapeUv,
  UV_FACE_TO_VOXEL
} from "../../../src/features/texture/blockShapeUv.ts";

// CONSTANTS
const kShapes = BlockShapeRegistry.createDefault();

function shapeOf(
  id: string
): BlockShape {
  const shape = kShapes.get(id);
  assert.ok(shape, `missing shape ${id}`);

  return shape;
}

describe("blockShapeUv", () => {
  it("reads a cube as a plain six-face box", () => {
    const topology = blockShapeUv(shapeOf("cube"));

    assert.equal(topology.isBox, true);
    assert.deepEqual(topology.activeFaces, [...UV_FACES]);
    assert.deepEqual(topology.triangles, {});
  });

  it("drops the face slot a ramp never renders", () => {
    const topology = blockShapeUv(shapeOf("ramp"));

    assert.equal(topology.isBox, false);
    assert.deepEqual(topology.activeFaces, [
      "front",
      "left",
      "right",
      "top",
      "bottom"
    ]);
  });

  it("derives the right-angle corner of a ramp's triangular sides", () => {
    const topology = blockShapeUv(shapeOf("ramp"));

    assert.deepEqual(topology.triangles, {
      left: "bottom-left",
      right: "bottom-right"
    });
  });

  it("keeps a stair off the box path, though its slots fill the tile", () => {
    const topology = blockShapeUv(shapeOf("stair"));

    assert.equal(topology.isBox, false);
    assert.deepEqual(topology.triangles, {});
    assert.deepEqual(topology.bounds.back, { u0: 0, v0: 0, u1: 1, v1: 1 });
  });

  it("reads only a cube as a plain box", () => {
    const boxes = [...kShapes]
      .filter((shape) => blockShapeUv(shape).isBox)
      .map((shape) => shape.id);

    assert.deepEqual(boxes, ["cube"]);
  });

  it("gives a cube face the whole tile", () => {
    const topology = blockShapeUv(shapeOf("cube"));

    for (const face of UV_FACES) {
      assert.deepEqual(
        topology.bounds[face],
        { u0: 0, v0: 0, u1: 1, v1: 1 },
        `cube ${face} does not cover its tile`
      );
    }
  });

  it("narrows a pole side to the width of the pole", () => {
    const topology = blockShapeUv(shapeOf("pole"));

    assert.deepEqual(topology.bounds.top, {
      u0: 0.375,
      v0: 0,
      u1: 0.625,
      v1: 1
    });
    assert.deepEqual(topology.bounds.front, {
      u0: 0.375,
      v0: 0.375,
      u1: 0.625,
      v1: 0.625
    });
    assert.equal(topology.isBox, false);
  });

  it("halves a slab side while keeping its top whole", () => {
    const bottom = blockShapeUv(shapeOf("slabBottom"));
    const top = blockShapeUv(shapeOf("slabTop"));

    assert.deepEqual(bottom.bounds.front, { u0: 0, v0: 0, u1: 1, v1: 0.5 });
    assert.deepEqual(top.bounds.front, { u0: 0, v0: 0.5, u1: 1, v1: 1 });
    assert.deepEqual(bottom.bounds.top, { u0: 0, v0: 0, u1: 1, v1: 1 });
  });

  it("unions the quads a slot owns rather than taking the first", () => {
    const topology = blockShapeUv(shapeOf("stair"));

    assert.deepEqual(topology.bounds.back, { u0: 0, v0: 0, u1: 1, v1: 1 });
  });

  it("names a triangle corner against its own footprint", () => {
    const shape: BlockShape = {
      id: "halfWedge",
      collisionHint: "trimesh",
      faces: [
        {
          face: Face.PosZ,
          normal: [0, 0, 1],
          vertices: [[0, 0, 1], [0.5, 0, 1], [0.5, 0.5, 1]],
          uvs: [[0, 0], [0.5, 0], [0.5, 0.5]],
          cull: null
        }
      ],
      occludes: () => false
    };
    const topology = blockShapeUv(shape);

    assert.deepEqual(topology.bounds.front, {
      u0: 0,
      v0: 0,
      u1: 0.5,
      v1: 0.5
    });
    assert.equal(topology.triangles.front, "bottom-right");
  });

  it("merges the several quads a stair slot owns into one range", () => {
    const topology = blockShapeUv(shapeOf("stair"));

    assert.equal(topology.faceRanges.top?.length, 1);
    assert.equal(topology.faceRanges.top?.[0].count, 8);
    assert.equal(topology.faceRanges.front?.[0].count, 4);
  });

  it("covers the geometry with no gap or overlap between faces", () => {
    const topology = blockShapeUv(shapeOf("stairCornerOuter"));
    const ranges = topology.activeFaces
      .flatMap((face) => topology.faceRanges[face] ?? [])
      .toSorted((a, b) => a.start - b.start);

    let expected = 0;
    for (const range of ranges) {
      assert.equal(range.start, expected);
      expected += range.count;
    }
    assert.equal(expected, 13 * 4);
  });

  it("gives every default shape at least one editable face", () => {
    for (const shape of kShapes) {
      const topology = blockShapeUv(shape);

      assert.ok(
        topology.activeFaces.length > 0,
        `${shape.id} has no active face`
      );
      for (const face of topology.activeFaces) {
        assert.ok(
          topology.faceRanges[face],
          `${shape.id} has no range for ${face}`
        );
      }
    }
  });

  it("falls back to a box for a shape with no recognizable face", () => {
    const shape: BlockShape = {
      id: "custom",
      collisionHint: "none",
      faces: [],
      occludes: () => false
    };
    const topology = blockShapeUv(shape);

    assert.deepEqual(topology.activeFaces, []);
    assert.deepEqual(topology.faceRanges, {});
  });

  it("maps a custom shape without any per-id special case", () => {
    const shape: BlockShape = {
      id: "wedge",
      collisionHint: "trimesh",
      faces: [
        {
          face: Face.PosX,
          normal: [1, 0, 0],
          vertices: [[1, 0, 0], [1, 1, 0], [1, 0, 1]],
          uvs: [[0, 0], [0, 1], [1, 0]],
          cull: null
        }
      ],
      occludes: () => false
    };
    const topology = blockShapeUv(shape);

    assert.deepEqual(topology.activeFaces, ["right"]);
    assert.equal(topology.triangles.right, "bottom-left");
    assert.deepEqual(topology.faceRanges.right, [{ start: 0, count: 3 }]);
  });
});

describe("UV_FACE_TO_VOXEL", () => {
  it("maps each UV face onto a distinct voxel face", () => {
    const voxelFaces = UV_FACES.map((face) => UV_FACE_TO_VOXEL[face]);

    assert.equal(new Set(voxelFaces).size, UV_FACES.length);
    assert.equal(UV_FACE_TO_VOXEL.front, Face.PosZ);
    assert.equal(UV_FACE_TO_VOXEL.top, Face.PosY);
  });
});
