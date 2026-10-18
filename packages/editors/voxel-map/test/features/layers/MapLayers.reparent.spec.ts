// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { JollyReparentDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { MapLayers, type ConfirmPrompt } from "../../../src/features/layers/MapLayers.ts";
import {
  EditContext,
  ObjectLayerRef,
  ObjectRef,
  SelectionStore,
  VoxelLayerRef
} from "../../../src/state/index.ts";
import { createMapDocument } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";

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
  return new VoxelLayerRef(name).key;
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

function createMapLayers(
  world: VoxelWorld,
  confirm: ConfirmPrompt = () => Promise.resolve(true),
  access = mapAccess()
): MapLayers {
  return new MapLayers({
    world,
    editContext: new EditContext(),
    selection: new SelectionStore(),
    mapDocument: createMapDocument(world),
    confirm,
    access
  });
}

describe("MapLayers.reparent - voxel layers", () => {
  test("restacks a layer dropped above a lower one", () => {
    const world = makeWorld();
    assert.deepEqual(stack(world), ["C", "B", "A"]);

    createMapLayers(world).reparent({
      movedIds: [voxelId("C")],
      targetId: voxelId("A"),
      where: "above"
    });

    assert.deepEqual(stack(world), ["B", "C", "A"]);
  });

  test("restacks a layer dropped below the bottom one", () => {
    const world = makeWorld();

    createMapLayers(world).reparent({
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

      createMapLayers(world).reparent({
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

    createMapLayers(world).reparent({
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
        targetId: new ObjectLayerRef("Triggers").key,
        where: "above"
      }
    ];

    for (const detail of refused) {
      createMapLayers(world).reparent(detail);
    }

    assert.deepEqual(stack(world), ["C", "B", "A"]);
  });
});

describe("MapLayers.reparent - objects", () => {
  test("hands an object to the object layer it is dropped inside", () => {
    const world = makeWorld();

    createMapLayers(world).reparent({
      movedIds: [
        new ObjectRef("Triggers", "obj_1").key
      ],
      targetId: new ObjectLayerRef("Spawns").key,
      where: "inside"
    });

    assert.deepEqual(objectIds(world, "Triggers"), []);
    assert.deepEqual(objectIds(world, "Spawns"), ["obj_1"]);
  });

  test("leaves the layers alone for a move that did not happen", () => {
    const world = makeWorld();

    createMapLayers(world).reparent({
      movedIds: [
        new ObjectRef("Triggers", "gone").key
      ],
      targetId: new ObjectLayerRef("Spawns").key,
      where: "inside"
    });

    assert.deepEqual(objectIds(world, "Triggers"), ["obj_1"]);
    assert.deepEqual(objectIds(world, "Spawns"), []);
  });
});
