// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  VoxelWorld,
  type VoxelLayerCommand
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentEvents } from "../../../src/document/index.ts";
import {
  LocalLayerVisibility
} from "../../../src/features/layers/LocalLayerVisibility.ts";
import { createObjectAt } from "../../../src/features/layers/objects/objectArea.ts";
import { LayerVisibilityStore } from "../../../src/state/LayerVisibilityStore.ts";

function setup() {
  const world = new VoxelWorld(4);
  world.addLayer("Ground");
  world.objectLayers.add("Triggers");
  world.objectLayers.add("Spawns");

  const mapDocument = new Emitter<MapDocumentEvents>();
  const commands: VoxelLayerCommand[] = [];
  world.on("command", (command) => {
    commands.push(command);
    mapDocument.emit("layerUpdated", command);
  });

  const visibility = new LayerVisibilityStore();
  const local = new LocalLayerVisibility({
    world,
    mapDocument,
    visibility
  });

  return {
    world,
    mapDocument,
    commands,
    visibility,
    local
  };
}

describe("LocalLayerVisibility", () => {
  test("hides a voxel layer without emitting a command", () => {
    const { world, commands, visibility } = setup();
    commands.length = 0;

    visibility.override("voxel:Ground", false);

    assert.strictEqual(world.getLayer("Ground")?.visible, false);
    assert.deepStrictEqual(commands, []);
  });

  test("leaves object layers untouched in the world", () => {
    const { world, commands, visibility } = setup();
    commands.length = 0;

    visibility.override("object:Triggers", false);

    assert.strictEqual(world.objectLayers.get("Triggers")?.visible, true);
    assert.deepStrictEqual(commands, []);
  });

  test("keeps the local value over an incoming visibility update", () => {
    const { world, visibility } = setup();
    visibility.override("voxel:Ground", false);

    world.updateLayer("Ground", { visible: true });

    assert.strictEqual(world.getLayer("Ground")?.visible, false);
  });

  test("gives a cloned layer the override of its source", () => {
    const { world, visibility } = setup();
    visibility.override("voxel:Ground", false);

    const clone = world.cloneLayer("Ground");

    assert.ok(clone);
    assert.strictEqual(visibility.resolve(`voxel:${clone.name}`, true), false);
    assert.deepStrictEqual(
      [...visibility.keys],
      ["voxel:Ground", `voxel:${clone.name}`]
    );
  });

  test("gives a cloned layer no override when its source has none", () => {
    const { world, visibility } = setup();

    world.cloneLayer("Ground");

    assert.deepStrictEqual([...visibility.keys], []);
  });

  test("forgets the override of a removed or merged layer", () => {
    const { world, visibility } = setup();
    world.addLayer("Top");
    world.addLayer("Detail");
    visibility.override("voxel:Top", false);
    visibility.override("voxel:Detail", false);

    world.removeLayer("Top");
    world.mergeLayer("Detail", "Ground");

    assert.deepStrictEqual([...visibility.keys], []);
  });

  test("forgets an object layer and its objects when it is removed", () => {
    const { world, visibility } = setup();
    const object = createObjectAt("Door", { x: 0, y: 0, z: 0 });
    world.objectLayers.addObject("Triggers", object);
    visibility.override("object:Triggers", false);
    visibility.override(`obj:Triggers/${object.id}`, false);
    visibility.override("object:Spawns", false);

    world.objectLayers.remove("Triggers");

    assert.deepStrictEqual([...visibility.keys], ["object:Spawns"]);
  });

  test("follows an object moved to another layer", () => {
    const { world, visibility } = setup();
    const object = createObjectAt("Door", { x: 0, y: 0, z: 0 });
    world.objectLayers.addObject("Triggers", object);
    visibility.override(`obj:Triggers/${object.id}`, false);

    world.objectLayers.moveObject("Triggers", object.id, "Spawns");

    assert.deepStrictEqual([...visibility.keys], [`obj:Spawns/${object.id}`]);
    assert.strictEqual(
      visibility.resolve(`obj:Spawns/${object.id}`, true),
      false
    );
  });

  test("forgets a removed object", () => {
    const { world, visibility } = setup();
    const object = createObjectAt("Door", { x: 0, y: 0, z: 0 });
    world.objectLayers.addObject("Triggers", object);
    visibility.override(`obj:Triggers/${object.id}`, false);

    world.objectLayers.removeObject("Triggers", object.id);

    assert.deepStrictEqual([...visibility.keys], []);
  });

  test("re-applies overrides and prunes missing entries on reset", () => {
    const { world, mapDocument, visibility } = setup();
    visibility.override("voxel:Ground", false);
    visibility.override("object:Gone", false);
    world.setLayerVisible("Ground", true);

    mapDocument.emit("reset");

    assert.strictEqual(world.getLayer("Ground")?.visible, false);
    assert.deepStrictEqual([...visibility.keys], ["voxel:Ground"]);
  });

  test("applies existing overrides when created", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const visibility = new LayerVisibilityStore();
    visibility.override("voxel:Ground", false);

    const local = new LocalLayerVisibility({
      world,
      mapDocument: new Emitter<MapDocumentEvents>(),
      visibility
    });

    assert.strictEqual(world.getLayer("Ground")?.visible, false);
    local.dispose();
  });

  test("stops applying overrides once disposed", () => {
    const { world, visibility, local } = setup();

    local.dispose();
    visibility.override("voxel:Ground", false);

    assert.strictEqual(world.getLayer("Ground")?.visible, true);
  });
});
