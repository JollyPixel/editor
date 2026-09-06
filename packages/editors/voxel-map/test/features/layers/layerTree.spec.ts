// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  layerRefOf,
  layerRowId,
  layerSelectionOf,
  layerTreeNodes,
  type LayerRef
} from "../../../src/features/layers/layerTree.ts";

describe("layer tree references", () => {
  const refs: LayerRef[] = [
    {
      kind: "voxel-layer",
      name: "Ground"
    },
    {
      kind: "object-layer",
      name: "Triggers"
    },
    {
      kind: "object",
      layerName: "Triggers/Inside",
      objectId: "spawn"
    }
  ];

  test("round-trips every row kind", () => {
    for (const ref of refs) {
      assert.deepStrictEqual(layerRefOf(layerRowId(ref)), ref);
    }
  });

  test("converts a tree reference to editor selection", () => {
    assert.deepStrictEqual(layerSelectionOf(refs[2]), {
      kind: "object",
      layerName: "Triggers/Inside",
      objectId: "spawn"
    });
  });
});

describe("layerTreeNodes", () => {
  test("projects voxel layers, object layers and their objects", () => {
    const world = {
      getLayers: () => [
        {
          name: "Ground",
          visible: true
        }
      ],
      getObjectLayers: () => [
        {
          name: "Triggers",
          visible: false,
          objects: [
            {
              id: "spawn",
              name: "Spawn",
              visible: true,
              locked: true
            }
          ]
        }
      ]
    };
    const nodes = layerTreeNodes(world as unknown as VoxelWorld);

    assert.strictEqual(nodes.length, 2);
    assert.deepStrictEqual(nodes[0].data, {
      kind: "voxel-layer",
      name: "Ground"
    });
    assert.strictEqual(nodes[1].visible, false);
    assert.deepStrictEqual(nodes[1].children?.[0], {
      id: "obj:Triggers/spawn",
      label: "Spawn",
      icon: "object-area",
      visible: true,
      locked: true,
      renamable: true,
      data: {
        kind: "object",
        layerName: "Triggers",
        objectId: "spawn"
      }
    });
  });
});
