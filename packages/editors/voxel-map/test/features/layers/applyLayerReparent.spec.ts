// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { JollyReparentDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { applyLayerReparent } from "../../../src/features/layers/layerDrop.ts";
import { layerRowId } from "../../../src/features/layers/layerTree.ts";

describe("applyLayerReparent — voxel layers", () => {
  test("restacks a layer dropped above a lower one", () => {
    const world = makeWorld();
    assert.deepEqual(stack(world), ["C", "B", "A"]);

    applyLayerReparent(world, {
      movedIds: [voxelId("C")],
      targetId: voxelId("A"),
      where: "above"
    });

    assert.deepEqual(stack(world), ["B", "C", "A"]);
  });

  test("restacks a layer dropped below the bottom one", () => {
    const world = makeWorld();

    applyLayerReparent(world, {
      movedIds: [voxelId("C")],
      targetId: voxelId("A"),
      where: "below"
    });

    assert.deepEqual(stack(world), ["B", "A", "C"]);
  });

  test("lands a layer where the drop marker showed it", () => {
    const cases: [string, string, "above" | "below", string[]][] = [
      ["D", "B", "above", ["C", "D", "B", "A"]],
      ["D", "B", "below", ["C", "B", "D", "A"]],
      ["A", "C", "above", ["D", "A", "C", "B"]],
      ["A", "C", "below", ["D", "C", "A", "B"]],
      ["C", "B", "above", ["D", "C", "B", "A"]],
      ["C", "D", "below", ["D", "C", "B", "A"]],
      ["A", "D", "above", ["A", "D", "C", "B"]],
      ["D", "A", "below", ["C", "B", "A", "D"]],
      ["A", "NoSuch", "above", ["D", "C", "B", "A"]],
      ["NoSuch", "A", "above", ["D", "C", "B", "A"]]
    ];

    for (const [moved, target, where, expected] of cases) {
      const world = makeWorld();
      world.addLayer("D");

      applyLayerReparent(world, {
        movedIds: [voxelId(moved)],
        targetId: voxelId(target),
        where
      });

      assert.deepEqual(stack(world), expected, `${moved} ${where} ${target}`);
    }
  });

  test("emits one layer-moved command for the whole move", () => {
    const world = makeWorld();
    const actions: string[] = [];
    world.on("command", (event) => actions.push(event.action));

    applyLayerReparent(world, {
      movedIds: [voxelId("C")],
      targetId: voxelId("A"),
      where: "below"
    });

    assert.deepEqual(actions, ["layer-moved"]);
  });

  test("leaves the stack alone for a drop the rules refuse", () => {
    const world = makeWorld();
    const refused: JollyReparentDetail[] = [
      {
        movedIds: [voxelId("C")],
        targetId: voxelId("A"),
        where: "inside"
      },
      {
        movedIds: [voxelId("C")],
        targetId: layerRowId({ kind: "object-layer", name: "Triggers" }),
        where: "above"
      }
    ];

    for (const detail of refused) {
      applyLayerReparent(world, detail);
    }

    assert.deepEqual(stack(world), ["C", "B", "A"]);
  });
});

describe("applyLayerReparent — objects", () => {
  test("hands an object to the object layer it is dropped inside", () => {
    const world = makeWorld();

    applyLayerReparent(world, {
      movedIds: [
        layerRowId({
          kind: "object",
          layerName: "Triggers",
          objectId: "obj_1"
        })
      ],
      targetId: layerRowId({ kind: "object-layer", name: "Spawns" }),
      where: "inside"
    });

    assert.deepEqual(objectIds(world, "Triggers"), []);
    assert.deepEqual(objectIds(world, "Spawns"), ["obj_1"]);
  });

  test("reports where each moved object landed", () => {
    const world = makeWorld();

    const relocated = applyLayerReparent(world, {
      movedIds: [
        layerRowId({
          kind: "object",
          layerName: "Triggers",
          objectId: "obj_1"
        })
      ],
      targetId: layerRowId({ kind: "object-layer", name: "Spawns" }),
      where: "inside"
    });

    assert.deepEqual(relocated, [
      {
        kind: "object",
        layerName: "Spawns",
        objectId: "obj_1"
      }
    ]);
  });

  test("reports nothing for a move that did not happen", () => {
    const world = makeWorld();

    const relocated = applyLayerReparent(world, {
      movedIds: [
        layerRowId({
          kind: "object",
          layerName: "Triggers",
          objectId: "gone"
        })
      ],
      targetId: layerRowId({ kind: "object-layer", name: "Spawns" }),
      where: "inside"
    });

    assert.deepEqual(relocated, []);
    assert.deepEqual(objectIds(world, "Triggers"), ["obj_1"]);
    assert.deepEqual(objectIds(world, "Spawns"), []);
  });
});

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer("A");
  world.addLayer("B");
  world.addLayer("C");
  world.objectLayers.add("Triggers");
  world.objectLayers.add("Spawns");
  world.objectLayers.addObject("Triggers", {
    id: "obj_1",
    name: "Area",
    visible: true,
    x: 0,
    y: 0,
    z: 0
  });

  return world;
}

function voxelId(
  name: string
): string {
  return layerRowId({
    kind: "voxel-layer",
    name
  });
}

function stack(
  world: VoxelWorld
): string[] {
  return world.getLayers().map((layer) => layer.name);
}

function objectIds(
  world: VoxelWorld,
  layerName: string
): string[] {
  return world
    .objectLayers.get(layerName)
    ?.objects
    .map((object) => object.id) ?? [];
}
