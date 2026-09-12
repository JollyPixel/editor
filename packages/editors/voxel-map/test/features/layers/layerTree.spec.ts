// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { TreeNode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  layerRefOf,
  layerRowId,
  layerSelectionOf,
  layerTreeNodes,
  withLayerBadges,
  type LayerRef
} from "../../../src/features/layers/layerTree.ts";
import type { PeerMark } from "../../../src/collaboration/peerMarks.ts";

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

describe("withLayerBadges", () => {
  const nodes: TreeNode<LayerRef>[] = [
    {
      id: "voxel:Ground",
      label: "Ground",
      data: {
        kind: "voxel-layer",
        name: "Ground"
      }
    },
    {
      id: "object:Triggers",
      label: "Triggers",
      data: {
        kind: "object-layer",
        name: "Triggers"
      },
      children: [
        {
          id: "obj:Triggers/spawn",
          label: "Spawn",
          data: {
            kind: "object",
            layerName: "Triggers",
            objectId: "spawn"
          }
        }
      ]
    }
  ];

  function mark(
    clientId: string,
    color: string
  ): PeerMark {
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
    const badged = withLayerBadges(
      nodes,
      new Map([["voxel-layer:Ground", [mark("bob", "#ff0000")]]])
    );

    assert.deepStrictEqual(badged[0].badges, [
      {
        color: "#ff0000",
        title: "bob"
      }
    ]);
  });

  test("badges a nested object row", () => {
    const badged = withLayerBadges(
      nodes,
      new Map([["object:spawn", [mark("bob", "#ff0000")]]])
    );

    assert.strictEqual(badged[1].badges, undefined);
    assert.deepStrictEqual(
      badged[1].children?.[0].badges?.map((badge) => badge.title),
      ["bob"]
    );
  });

  test("caps a row at three badges", () => {
    const badged = withLayerBadges(
      nodes,
      new Map([[
        "voxel-layer:Ground",
        ["a", "b", "c", "d"].map((clientId) => mark(clientId, "#fff"))
      ]])
    );

    assert.deepStrictEqual(
      badged[0].badges?.map((badge) => badge.title),
      ["a", "b", "c"]
    );
  });

  test("does not mutate the source nodes", () => {
    withLayerBadges(
      nodes,
      new Map([["voxel-layer:Ground", [mark("bob", "#ff0000")]]])
    );

    assert.strictEqual(nodes[0].badges, undefined);
  });
});
