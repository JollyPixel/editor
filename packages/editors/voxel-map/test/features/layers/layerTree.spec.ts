// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type {
  PresencePeer,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  layerTreeNodes,
  withLayerBadges
} from "../../../src/features/layers/layerTree.ts";
import {
  ObjectLayerRef,
  ObjectRef,
  VoxelLayerRef,
  type LayerRef
} from "../../../src/state/index.ts";
import { LayerVisibilityStore } from "../../../src/features/layers/LayerVisibilityStore.ts";

// CONSTANTS
const kEditable = {
  canEdit: () => true
};
const kViewOnly = {
  canEdit: () => false
};

describe("layerTreeNodes", () => {
  test("projects voxel layers, object layers and their objects", () => {
    const world = {
      getLayers: () => [
        {
          name: "Ground",
          visible: true,
          voxelCount: 1234
        }
      ],
      objectLayers: {
        toArray: () => [
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
      }
    };
    const nodes = layerTreeNodes(
      world as unknown as VoxelWorld,
      new LayerVisibilityStore(),
      kEditable
    );

    assert.strictEqual(nodes.length, 2);
    assert.deepStrictEqual(nodes[0].data, new VoxelLayerRef("Ground"));
    assert.strictEqual(nodes[0].detail, "1,234 voxels");
    assert.strictEqual(nodes[1].detail, undefined);
    assert.strictEqual(nodes[1].visible, false);
    assert.deepStrictEqual(nodes[1].children?.[0], {
      id: "obj:Triggers/spawn",
      label: "Spawn",
      icon: "object-area",
      visible: true,
      locked: true,
      renamable: true,
      data: new ObjectRef("Triggers", "spawn")
    });
  });

  test("shows local visibility overrides over the saved values", () => {
    const world = {
      getLayers: () => [
        {
          name: "Ground",
          visible: true,
          voxelCount: 0
        }
      ],
      objectLayers: {
        toArray: () => [
          {
            name: "Triggers",
            visible: false,
            objects: [
              {
                id: "spawn",
                name: "Spawn",
                visible: true
              }
            ]
          }
        ]
      }
    };
    const visibility = new LayerVisibilityStore();
    visibility.override("voxel:Ground", false);
    visibility.override("object:Triggers", true);
    visibility.override("obj:Triggers/spawn", false);

    const [ground, triggers] = layerTreeNodes(
      world as unknown as VoxelWorld,
      visibility,
      kEditable
    );

    assert.strictEqual(ground.visible, false);
    assert.strictEqual(triggers.visible, true);
    assert.strictEqual(triggers.children?.[0].visible, false);
  });

  test("drops the lock toggle of objects the user cannot change", () => {
    const world = {
      getLayers: () => [],
      objectLayers: {
        toArray: () => [
          {
            name: "Triggers",
            visible: true,
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
      }
    };

    const [triggers] = layerTreeNodes(
      world as unknown as VoxelWorld,
      new LayerVisibilityStore(),
      kViewOnly
    );

    assert.strictEqual(triggers.children?.[0].locked, undefined);
  });
});

describe("withLayerBadges", () => {
  const nodes: TreeNode<LayerRef>[] = [
    {
      id: "voxel:Ground",
      label: "Ground",
      data: new VoxelLayerRef("Ground")
    },
    {
      id: "object:Triggers",
      label: "Triggers",
      data: new ObjectLayerRef("Triggers"),
      children: [
        {
          id: "obj:Triggers/spawn",
          label: "Spawn",
          data: new ObjectRef("Triggers", "spawn")
        }
      ]
    }
  ];

  function mark(
    clientId: string,
    color: string
  ): PresencePeer {
    return {
      clientId,
      displayName: clientId,
      color
    };
  }

  test("leaves every row untouched when no peer selects anything", () => {
    const badged = withLayerBadges(nodes, new Map());

    assert.strictEqual(badged[0].badges, undefined);
    assert.strictEqual(badged[1].children?.[0].badges, undefined);
  });

  test("badges a voxel layer with the color and name of its peers", () => {
    const badged = withLayerBadges(nodes, new Map([
      ["voxel:Ground", [mark("bob", "#ff0000")]]
    ]));

    assert.deepStrictEqual(badged[0].badges, [
      {
        color: "#ff0000",
        title: "bob"
      }
    ]);
  });

  test("badges a nested object row", () => {
    const badged = withLayerBadges(nodes, new Map([
      ["obj:Triggers/spawn", [mark("bob", "#ff0000")]]
    ]));

    assert.strictEqual(badged[1].badges, undefined);
    assert.deepStrictEqual(
      badged[1].children?.[0].badges?.map((badge) => badge.title),
      ["bob"]
    );
  });

  test("does not mutate the source nodes", () => {
    withLayerBadges(nodes, new Map([["voxel:Ground", [mark("bob", "#ff0000")]]]));

    assert.strictEqual(nodes[0].badges, undefined);
  });
});
