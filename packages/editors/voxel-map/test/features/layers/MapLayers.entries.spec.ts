// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import { Grants } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { MapLayers, type ConfirmPrompt } from "../../../src/features/layers/MapLayers.ts";
import {
  ObjectLayerRef,
  ObjectRef,
  SelectionStore,
  VoxelLayerRef
} from "../../../src/state/index.ts";
import { createMapDocument } from "../../helpers/mapDocument.ts";
import { mapAccess } from "../../helpers/mapAccess.ts";
import type { MapCapability } from "../../../src/access/MapAccess.ts";

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
    selection: new SelectionStore(),
    mapDocument: createMapDocument(world),
    confirm,
    access
  });
}

describe("MapLayers entries", () => {
  test("adds a voxel layer, an object layer and an object at the focus", () => {
    const world = makeWorld();
    const selection = new SelectionStore();
    const layers = new MapLayers({
      world,
      selection,
      mapDocument: createMapDocument(world),
      access: mapAccess()
    });
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
    assert.deepEqual(createMapLayers(makeWorld()).defaultNames(), {
      "voxel-layer": "Layer 4",
      "object-layer": "Objects 3",
      object: "Object"
    });
  });

  test("removes an object at once and a layer once confirmed", async() => {
    const world = makeWorld();
    const prompts: string[] = [];
    const layers = createMapLayers(world, (options) => {
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
    const layers = createMapLayers(world);

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
    new MapLayers({
      world,
      selection,
      mapDocument: createMapDocument(world),
      access: mapAccess()
    }).clone(new VoxelLayerRef("A"));

    assert.equal(selection.voxelLayer, "A (1)");
    assert.equal(world.getLayers().length, 4);
  });

  test("selects a clone of an object in the same layer", () => {
    const world = makeWorld();
    const selection = new SelectionStore();
    new MapLayers({
      world,
      selection,
      mapDocument: createMapDocument(world),
      access: mapAccess()
    }).clone(new ObjectRef("Triggers", "obj_1"));

    const [original, clone] = world.objectLayers.get("Triggers")!.objects;
    assert.notEqual(clone.id, original.id);
    assert.deepEqual({ ...clone, id: original.id }, original);
    assert.deepEqual(selection.object, new ObjectRef("Triggers", clone.id));
  });

  test("merges into the given target and selects it", async() => {
    const world = makeWorld();
    const selection = new SelectionStore();
    const layers = new MapLayers({
      world,
      selection,
      mapDocument: createMapDocument(world),
      access: mapAccess()
    });

    await layers.mergeInto(new VoxelLayerRef("C"), "A");

    assert.deepEqual(stack(world), ["B", "A"]);
    assert.equal(selection.voxelLayer, "A");
  });

  test("merges nothing into itself, an unknown layer or past a refused warning", async() => {
    const world = makeWorld();
    world.updateLayer("C", { visible: false });
    const prompts: string[] = [];
    const layers = createMapLayers(world, (options) => {
      prompts.push(options.message);

      return Promise.resolve(false);
    });

    await layers.mergeInto(new VoxelLayerRef("C"), "C");
    await layers.mergeInto(new VoxelLayerRef("C"), "NoSuch");
    await layers.mergeInto(new VoxelLayerRef("C"), "A");

    assert.equal(prompts.length, 1);
    assert.deepEqual(stack(world), ["C", "B", "A"]);
  });

  test("bounds a voxel layer by its voxels and an object layer by its objects", () => {
    const world = makeWorld();
    world.setVoxel("A", { position: { x: 2, y: 1, z: 3 }, blockId: 1 });
    world.objectLayers.addObject("Triggers", {
      id: "obj_2",
      name: "Wide",
      visible: true,
      x: 4,
      y: 0,
      z: 0,
      width: 2,
      height: 3
    });
    const layers = createMapLayers(world);

    const voxel = layers.bounds(new VoxelLayerRef("A"));
    const objects = layers.bounds(new ObjectLayerRef("Triggers"));

    assert.deepEqual([voxel?.min.toArray(), voxel?.max.toArray()], [[2, 1, 3], [3, 2, 4]]);
    assert.deepEqual([objects?.min.toArray(), objects?.max.toArray()], [[0, 0, 0], [6, 1, 3]]);
    assert.equal(layers.bounds(new VoxelLayerRef("B")), null);
    assert.equal(layers.bounds(new ObjectLayerRef("Spawns")), null);
  });

  test("moves an object into another object layer with the objects grant", () => {
    const world = makeWorld();
    const door = new ObjectRef("Triggers", "obj_1");

    createMapLayers(world, undefined, mapAccess(new Grants<MapCapability>(["layers"])))
      .moveTo(door, "Spawns");
    assert.deepEqual(objectIds(world, "Spawns"), []);

    createMapLayers(world).moveTo(door, "Spawns");
    assert.deepEqual(objectIds(world, "Triggers"), []);
    assert.deepEqual(objectIds(world, "Spawns"), ["obj_1"]);
  });

  test("edits only the entries the role can write", async() => {
    const world = makeWorld();
    const layers = createMapLayers(
      world,
      undefined,
      mapAccess(new Grants<MapCapability>(["objects"]))
    );

    layers.create({ x: 0, y: 0, z: 0 }, { kind: "voxel-layer", name: "Top" });
    layers.clone(new VoxelLayerRef("A"));
    await layers.remove(new VoxelLayerRef("A"));
    layers.rename(new ObjectRef("Triggers", "obj_1"), "Door");

    assert.deepEqual(stack(world), ["C", "B", "A"]);
    assert.equal(world.objectLayers.get("Triggers")!.objects[0].name, "Door");
  });
});

describe("MapLayers selection", () => {
  test("selects an entry on creation and moves off a removed layer", () => {
    const world = makeWorld();
    const selection = new SelectionStore();
    new MapLayers({
      world,
      selection,
      mapDocument: createMapDocument(world),
      access: mapAccess()
    });

    assert.notEqual(selection.current, null);

    selection.selectVoxelLayer("B");
    world.removeLayer("B");

    assert.notEqual(selection.current, null);
    assert.notEqual(selection.voxelLayer, "B");
  });

  test("stops reconciling once disposed", () => {
    const world = makeWorld();
    const selection = new SelectionStore();
    const layers = new MapLayers({
      world,
      selection,
      mapDocument: createMapDocument(world),
      access: mapAccess()
    });
    selection.selectVoxelLayer("C");

    layers.dispose();
    world.removeLayer("C");

    assert.equal(selection.voxelLayer, "C");
  });
});
