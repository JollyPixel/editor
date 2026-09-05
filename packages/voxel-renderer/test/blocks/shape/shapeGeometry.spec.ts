// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  type BlockShape,
  BlockShapeRegistry,
  buildShapeGeometry,
  type ShapeGeometry
} from "../../../src/blocks/shape/index.ts";
import {
  Cube,
  Ramp,
  Stair
} from "../../../src/blocks/shape/library/index.ts";
import { FACE } from "../../../src/utils/math.ts";

function rangeOf(
  geometry: ShapeGeometry,
  face: FACE
) {
  return geometry.ranges.find(
    (range) => range.face === face
  );
}

describe("buildShapeGeometry", () => {
  it("emits four vertices and two triangles per cube face", () => {
    const geometry = buildShapeGeometry(new Cube());

    assert.equal(geometry.positions.length, 24 * 3);
    assert.equal(geometry.uvs.length, 24 * 2);
    assert.equal(geometry.indices.length, 6 * 6);
    assert.equal(geometry.ranges.length, 6);
    for (const range of geometry.ranges) {
      assert.equal(range.count, 4);
    }
  });

  it("orders ranges by FACE and leaves no gap between them", () => {
    const geometry = buildShapeGeometry(new Stair());
    const faces = geometry.ranges.map((range) => range.face);

    assert.deepEqual(faces, [
      FACE.PosX,
      FACE.NegX,
      FACE.PosY,
      FACE.NegY,
      FACE.PosZ,
      FACE.NegZ
    ]);

    let expected = 0;
    for (const range of geometry.ranges) {
      assert.equal(range.start, expected);
      expected += range.count;
    }
    assert.equal(expected, geometry.positions.length / 3);
  });

  it("groups the multiple quads a stair emits into one slot range", () => {
    const geometry = buildShapeGeometry(new Stair());

    // The stair splits PosY into two quads and PosZ stays a single quad.
    assert.equal(rangeOf(geometry, FACE.PosY)?.count, 8);
    assert.equal(rangeOf(geometry, FACE.PosZ)?.count, 4);
  });

  it("exposes the polygons a slot was built from", () => {
    const shape = new Stair();
    const geometry = buildShapeGeometry(shape);
    const range = rangeOf(geometry, FACE.PosY)!;

    assert.equal(range.definitions.length, 2);
    assert.deepEqual(
      range.definitions,
      shape.faces.filter((face) => face.face === FACE.PosY)
    );
  });

  it("omits a slot the shape never uses", () => {
    const geometry = buildShapeGeometry(new Ramp());

    assert.equal(geometry.ranges.length, 5);
    assert.equal(rangeOf(geometry, FACE.NegZ), undefined);
  });

  it("triangulates a three vertex face into a single triangle", () => {
    const geometry = buildShapeGeometry(new Ramp());
    const range = rangeOf(geometry, FACE.NegX);

    assert.equal(range?.count, 3);
    assert.deepEqual(
      [...geometry.indices.slice(0, 3)],
      [0, 1, 2]
    );
  });

  it("keeps uvs in normalized tile space", () => {
    const geometry = buildShapeGeometry(new Stair());

    for (const value of geometry.uvs) {
      assert.ok(value >= 0 && value <= 1, `uv ${value} out of range`);
    }
  });

  it("copies the face normal onto every vertex of that polygon", () => {
    const geometry = buildShapeGeometry(new Cube());
    const range = rangeOf(geometry, FACE.PosX)!;

    for (let index = range.start; index < range.start + range.count; index++) {
      assert.deepEqual(
        [...geometry.normals.slice(index * 3, (index * 3) + 3)],
        [1, 0, 0]
      );
    }
  });

  it("returns empty buffers for a shape without faces", () => {
    const shape: BlockShape = {
      id: "empty",
      collisionHint: "none",
      faces: [],
      occludes: () => false
    };
    const geometry = buildShapeGeometry(shape);

    assert.equal(geometry.positions.length, 0);
    assert.equal(geometry.indices.length, 0);
    assert.deepEqual(geometry.ranges, []);
  });

  it("covers every default shape without dropping a face definition", () => {
    for (const shape of BlockShapeRegistry.createDefault()) {
      const geometry = buildShapeGeometry(shape);
      const vertices = shape.faces.reduce(
        (total, face) => total + face.vertices.length,
        0
      );

      assert.equal(
        geometry.positions.length / 3,
        vertices,
        `${shape.id} lost vertices`
      );
      assert.equal(
        geometry.ranges.reduce((total, range) => total + range.count, 0),
        vertices,
        `${shape.id} ranges do not cover every vertex`
      );
    }
  });
});
