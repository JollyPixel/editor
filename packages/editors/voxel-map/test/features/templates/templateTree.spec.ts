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

    assert.deepEqual(templateTreeNodes([house], new Map()), [
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

  test("marks a template that has a draft and badges the peers in it", () => {
    const templates = ["house", "tower"].map((id) => new VoxelTemplate({
      id,
      name: id,
      positions: [0, 0, 0],
      voxels: [packVoxel(1, 0)]
    }));
    const bob = {
      color: "#ff0000",
      title: "bob"
    };

    const [house, tower] = templateTreeNodes(templates, new Map([
      ["house", []],
      ["tower", [bob]]
    ]));

    assert.equal(house.detail, "1 voxel · draft");
    assert.equal(house.badges, undefined);
    assert.equal(tower.detail, "1 voxel · draft");
    assert.deepEqual(tower.badges, [bob]);
  });
});
