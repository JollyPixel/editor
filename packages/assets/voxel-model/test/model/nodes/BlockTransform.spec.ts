// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlockTransform } from "#src/model/nodes/BlockTransform.ts";

describe("BlockTransform", () => {
  test("poses a rest transform: adds position, adds rotation in degrees, multiplies scale", () => {
    const rest = BlockTransform.create({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: Math.PI, z: 0 },
      scale: { x: 2, y: 2, z: 2 },
      size: { x: 4, y: 1, z: 1 }
    });

    const posed = new BlockTransform(rest).pose({
      position: { x: 1, y: 0, z: -1 },
      rotation: { x: 90, y: -180, z: 0 },
      scale: { x: 0.5, y: 1, z: 2 }
    });

    assert.deepEqual(posed.position, { x: 2, y: 2, z: 2 });
    assert.deepEqual(posed.rotation, { x: Math.PI / 2, y: 0, z: 0 });
    assert.deepEqual(posed.scale, { x: 1, y: 2, z: 4 });
    assert.deepEqual(posed.size, rest.size);
    assert.deepEqual(new BlockTransform(rest).pose({}), rest);
  });

  test("finds the sample that poses the rest transform into a pose", () => {
    const rest = new BlockTransform(BlockTransform.create({
      position: { x: 1, y: 2, z: 3 },
      scale: { x: 2, y: 0, z: 2 }
    }));
    const sample = {
      position: { x: 1, y: 0, z: -1 },
      rotation: { x: 90, y: 0, z: 0 },
      scale: { x: 0.5, y: 1, z: 2 }
    };

    assert.deepEqual(rest.deltaTo(rest.pose(sample)), sample);
    assert.deepEqual(rest.deltaTo(rest.toJSON()), {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  });

  test("parses the five vectors of a transform and nothing else", () => {
    const transform = BlockTransform.create({ position: { x: 3, y: 0, z: 0 } });

    assert.deepEqual(BlockTransform.parse({ ...transform, extra: true }), transform);
    assert.equal(BlockTransform.parse({ ...transform, size: { x: 1, y: "1", z: 1 } }), undefined);
    assert.equal(BlockTransform.parse({ position: transform.position }), undefined);
    assert.equal(BlockTransform.parse(null), undefined);
  });
});
