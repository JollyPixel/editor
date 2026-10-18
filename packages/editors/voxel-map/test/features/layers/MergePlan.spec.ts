// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MergePlan } from "../../../src/features/layers/MergePlan.ts";

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer("A");
  world.addLayer("B");
  world.addLayer("C");

  return world;
}

describe("MergePlan targets", () => {
  test("offers every layer but the source, top first", () => {
    assert.deepEqual(MergePlan.planMerge(makeWorld(), "B").targets, ["C", "A"]);
  });

  test("never offers a template draft as a target", () => {
    const world = makeWorld();
    world.addLayer("House draft", { id: "template-draft:house" });

    assert.deepEqual(MergePlan.planMerge(world, "B").targets, ["C", "A"]);
  });

  test("has no target in a single-layer world", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Only");

    assert.deepEqual(MergePlan.planMerge(world, "Only").targets, []);
  });

  test("has no target when the source is unknown", () => {
    assert.deepEqual(MergePlan.planMerge(makeWorld(), "NoSuch").targets, []);
  });
});

describe("MergePlan warnings", () => {
  test("says nothing about a plain visible layer", () => {
    assert.deepEqual(MergePlan.planMerge(makeWorld(), "B").warnings, []);
  });

  test("warns that custom properties are folded in", () => {
    const world = makeWorld();
    world.updateLayer("B", { properties: { biome: "forest" } });

    const warnings = MergePlan.planMerge(world, "B").warnings;

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /custom propertie/);
  });

  test("warns that a hidden layer becomes visible", () => {
    const world = makeWorld();
    world.updateLayer("B", { visible: false });

    const warnings = MergePlan.planMerge(world, "B").warnings;

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /hidden/);
  });

  test("reports both reasons at once", () => {
    const world = makeWorld();
    world.updateLayer("B", {
      visible: false,
      properties: { biome: "forest" }
    });

    assert.equal(MergePlan.planMerge(world, "B").warnings.length, 2);
  });

  test("says nothing about an unknown layer", () => {
    assert.deepEqual(MergePlan.planMerge(makeWorld(), "NoSuch").warnings, []);
  });
});
