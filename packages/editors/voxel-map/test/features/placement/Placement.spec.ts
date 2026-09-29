// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  packVoxel,
  VoxelTemplate,
  VoxelTransform
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { Placement } from "../../../src/features/placement/Placement.ts";
import { TemplateSource } from "../../../src/features/placement/PlacementSource.ts";

// CONSTANTS
const kTemplate = new VoxelTemplate({
  id: "wall",
  name: "Wall",
  positions: [
    0, 0, 0,
    1, 0, 0,
    2, 0, 0
  ],
  voxels: [packVoxel(1, 0), packVoxel(1, 0), packVoxel(1, 0)]
});
const kSource = new TemplateSource("wall");

describe("Placement", () => {
  test("starts untransformed on a rounded cell", () => {
    const placement = Placement.at(kSource, { x: 3.6, y: 0.2, z: -1.5 });

    assert.deepEqual(placement.position, { x: 4, y: 0, z: -1 });
    assert.equal(placement.transform, VoxelTransform.Identity);
  });

  test("compares source, cell and transform", () => {
    const placement = Placement.at(kSource, { x: 0, y: 0, z: 0 });

    assert.equal(placement.equals(placement.movedTo({ x: 0.3, y: 0, z: 0 })), true);
    assert.equal(placement.equals(placement.movedTo({ x: 1, y: 0, z: 0 })), false);
    assert.equal(placement.equals(placement.turnedBy({ rotation: 1 })), false);
    assert.equal(placement.equals(placement.turnedBy({ rotation: 4 })), true);
    assert.equal(placement.equals(null), false);
    assert.equal(
      placement.equals(Placement.at(new TemplateSource("wall"), placement.position)),
      false
    );
  });

  test("frames the template and finds the pivot back from the frame", () => {
    const placement = Placement.at(kSource, { x: 10, y: 0, z: 0 })
      .turnedBy({ rotation: 1 });
    const bounds = placement.boundsIn(kTemplate);

    assert.deepEqual(bounds.size, { x: 1, y: 1, z: 3 });
    assert.deepEqual(
      placement.positionFor(kTemplate, bounds.min),
      placement.position
    );
  });
});
