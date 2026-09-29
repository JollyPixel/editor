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
import {
  MapLayers,
  type ConfirmPrompt
} from "../../../src/features/layers/MapLayers.ts";
import {
  ObjectLayerRef,
  ObjectRef,
  SelectionStore,
  VoxelLayerRef
} from "../../../src/state/index.ts";

// CONSTANTS
const kGround = new VoxelLayerRef("Ground").key;
const kDeco = new VoxelLayerRef("Deco").key;
const kTriggers = new ObjectLayerRef("Triggers").key;
const kSpawns = new ObjectLayerRef("Spawns").key;
const kTriggerArea = new ObjectRef("Triggers", "obj_1").key;
const kSpawnPoint = new ObjectRef("Spawns", "obj_2").key;

describe("MapLayers.acceptsDrop", () => {
  test("allows a voxel layer above or below another voxel layer", () => {
    for (const where of ["above", "below"] as const) {
      assert.equal(
        MapLayers.acceptsDrop(drop(kDeco, kGround, where)),
        true,
        `dropping ${where} should be allowed`
      );
    }
  });

  test("refuses a voxel layer dropped inside another voxel layer", () => {
    assert.equal(
      MapLayers.acceptsDrop(drop(kDeco, kGround, "inside")),
      false
    );
  });

  test("refuses a voxel layer anywhere near an object row", () => {
    for (const targetId of [kTriggers, kTriggerArea]) {
      for (const where of ["above", "inside", "below"] as const) {
        assert.equal(
          MapLayers.acceptsDrop(drop(kDeco, targetId, where)),
          false,
          `dropping ${where} ${targetId} should be refused`
        );
      }
    }
  });

  test("allows an object inside an object layer it does not belong to", () => {
    assert.equal(
      MapLayers.acceptsDrop(drop(kTriggerArea, kSpawns, "inside")),
      true
    );
  });

  test("refuses an object dropped inside the layer it already belongs to", () => {
    assert.equal(
      MapLayers.acceptsDrop(drop(kTriggerArea, kTriggers, "inside")),
      false
    );
  });

  test("refuses an object above or below an object layer", () => {
    for (const where of ["above", "below"] as const) {
      assert.equal(
        MapLayers.acceptsDrop(drop(kTriggerArea, kSpawns, where)),
        false,
        `dropping ${where} should be refused`
      );
    }
  });

  test("refuses an object onto another object, in either layer", () => {
    for (const where of ["above", "inside", "below"] as const) {
      assert.equal(
        MapLayers.acceptsDrop(drop(kTriggerArea, kSpawnPoint, where)),
        false,
        `dropping ${where} should be refused`
      );
    }
  });

  test("refuses an object layer everywhere, since nothing reads its order", () => {
    for (const targetId of [kGround, kSpawns, kSpawnPoint]) {
      for (const where of ["above", "inside", "below"] as const) {
        assert.equal(
          MapLayers.acceptsDrop(drop(kTriggers, targetId, where)),
          false,
          `dropping ${where} ${targetId} should be refused`
        );
      }
    }
  });

  test("refuses the whole drop when one moved row is not allowed", () => {
    assert.equal(
      MapLayers.acceptsDrop({
        movedIds: [kDeco, kTriggers],
        targetId: kGround,
        where: "above"
      }),
      false
    );
  });
});

function drop(
  movedId: string,
  targetId: string,
  where: JollyReparentDetail["where"]
): JollyReparentDetail {
  return {
    movedIds: [movedId],
    targetId,
    where
  };
}

describe("MapLayers.reparent - voxel layers", () => {
  test("restacks a layer dropped above a lower one", () => {
    const world = makeWorld();
    assert.deepEqual(stack(world), ["C", "B", "A"]);

    layersOf(world).reparent({
      movedIds: [voxelId("C")],
      targetId: voxelId("A"),
      where: "above"
    });

    assert.deepEqual(stack(world), ["B", "C", "A"]);
  });

  test("restacks a layer dropped below the bottom one", () => {
    const world = makeWorld();

    layersOf(world).reparent({
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

      layersOf(world).reparent({
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

    layersOf(world).reparent({
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
      layersOf(world).reparent(detail);
    }

    assert.deepEqual(stack(world), ["C", "B", "A"]);
  });
});

describe("MapLayers.reparent - objects", () => {
  test("hands an object to the object layer it is dropped inside", () => {
    const world = makeWorld();

    layersOf(world).reparent({
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

    layersOf(world).reparent({
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

describe("MapLayers entries", () => {
  test("adds a voxel layer, an object layer and an object at the focus", () => {
    const world = makeWorld();
    const selection = new SelectionStore();
    const layers = new MapLayers({ world, selection });
    const focus = { x: 3.4, y: 1, z: -2.6 };

    layers.create(focus, { kind: "voxel-layer", name: "Top" });
    assert.deepEqual(selection.current, new VoxelLayerRef("Top"));

    layers.create(focus, { kind: "object-layer", name: "Doors" });
    assert.deepEqual(selection.current, new ObjectLayerRef("Doors"));

    layers.create(focus, { kind: "object", name: "Door" });
    const [door] = world.objectLayers.get("Doors")!.objects;
    assert.deepEqual([door.name, door.x, door.z], ["Door", 3, -3]);
    assert.deepEqual(selection.current, new ObjectRef("Doors", door.id));
  });

  test("names new entries after the ones already there", () => {
    assert.deepEqual(layersOf(makeWorld()).defaultNames(), {
      "voxel-layer": "Layer 4",
      "object-layer": "Objects 3",
      object: "Object"
    });
  });

  test("removes an object at once and a layer once confirmed", async() => {
    const world = makeWorld();
    const prompts: string[] = [];
    const layers = layersOf(world, (options) => {
      prompts.push(options.message);

      return Promise.resolve(options.message.includes("\"A\""));
    });

    await layers.remove(new ObjectRef("Triggers", "obj_1"));
    await layers.remove(new VoxelLayerRef("B"));
    await layers.remove(new VoxelLayerRef("A"));

    assert.equal(prompts.length, 2);
    assert.deepEqual(objectIds(world, "Triggers"), []);
    assert.deepEqual(stack(world), ["C", "B"]);
  });

  test("renames and locks objects only", () => {
    const world = makeWorld();
    const layers = layersOf(world);

    layers.rename(new ObjectRef("Triggers", "obj_1"), "Door");
    layers.lock(new ObjectRef("Triggers", "obj_1"), true);
    layers.rename(new VoxelLayerRef("A"), "Renamed");

    const [object] = world.objectLayers.get("Triggers")!.objects;
    assert.deepEqual([object.name, object.locked], ["Door", true]);
    assert.deepEqual(stack(world), ["C", "B", "A"]);
  });

  test("selects the clone of a voxel layer", () => {
    const world = makeWorld();
    const selection = new SelectionStore();
    new MapLayers({ world, selection }).clone(new VoxelLayerRef("A"));

    assert.equal(selection.voxelLayer, "A (1)");
    assert.equal(world.getLayers().length, 4);
  });

  test("merges into the picked target and selects it", async() => {
    const world = makeWorld();
    const selection = new SelectionStore();
    const layers = new MapLayers({ world, selection });

    await layers.merge(new VoxelLayerRef("C"), (context) => {
      assert.equal(context.defaultTarget, "B");

      return Promise.resolve("A");
    });

    assert.deepEqual(stack(world), ["B", "A"]);
    assert.equal(selection.voxelLayer, "A");
  });
});

function layersOf(
  world: VoxelWorld,
  confirm: ConfirmPrompt = () => Promise.resolve(true)
): MapLayers {
  return new MapLayers({
    world,
    selection: new SelectionStore(),
    confirm
  });
}
