// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelTemplate,
  packVoxel
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { templateTreeNodes } from "../../../src/features/templates/templateTree.ts";

describe("templateTreeNodes", () => {
  test("lists templates as renamable rows keyed by id", () => {
    const house = new VoxelTemplate({
      id: "template_0",
      name: "House",
      positions: [0, 0, 0, 1, 0, 0],
      voxels: [packVoxel(1, 0), packVoxel(1, 0)]
    });

    assert.deepEqual(templateTreeNodes([house]), [
      {
        id: "template_0",
        label: "House",
        icon: "template",
        detail: "2 voxels",
        renamable: true,
        data: "template_0"
      }
    ]);
  });
});
