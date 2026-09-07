// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  mergeTargetsFor,
  mergeWarnings
} from "../../../src/features/layers/mergeTargets.ts";

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer("A");
  world.addLayer("B");
  world.addLayer("C");

  return world;
}

describe("mergeTargetsFor", () => {
  test("offers every layer but the source", () => {
    const { options } = mergeTargetsFor(makeWorld(), "B");

    assert.deepEqual(
      options.map((option) => option.value),
      ["C", "A"]
    );
  });

  test("labels each option with the layer name", () => {
    const { options } = mergeTargetsFor(makeWorld(), "B");

    assert.deepEqual(options[0], { value: "C", label: "C" });
  });

  test("defaults to the layer directly below the source", () => {
    assert.equal(mergeTargetsFor(makeWorld(), "C").defaultTarget, "B");
    assert.equal(mergeTargetsFor(makeWorld(), "B").defaultTarget, "A");
  });

  test("falls back to the first option for the bottom layer", () => {
    assert.equal(mergeTargetsFor(makeWorld(), "A").defaultTarget, "C");
  });

  test("has no target in a single-layer world", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Only");

    assert.deepEqual(mergeTargetsFor(world, "Only"), {
      options: [],
      defaultTarget: null
    });
  });

  test("has no target when the source is unknown", () => {
    assert.deepEqual(mergeTargetsFor(makeWorld(), "NoSuch"), {
      options: [],
      defaultTarget: null
    });
  });
});

describe("mergeWarnings", () => {
  test("says nothing about a plain visible layer", () => {
    assert.deepEqual(mergeWarnings(makeWorld(), "B"), []);
  });

  test("warns that custom properties are folded in", () => {
    const world = makeWorld();
    world.updateLayer("B", { properties: { biome: "forest" } });

    const warnings = mergeWarnings(world, "B");

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /custom propertie/);
  });

  test("warns that a hidden layer becomes visible", () => {
    const world = makeWorld();
    world.updateLayer("B", { visible: false });

    const warnings = mergeWarnings(world, "B");

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /hidden/);
  });

  test("treats a fully transparent layer as hidden", () => {
    const world = makeWorld();
    world.updateLayer("B", { opacity: 0 });

    assert.match(mergeWarnings(world, "B")[0], /hidden/);
  });

  test("reports both reasons at once", () => {
    const world = makeWorld();
    world.updateLayer("B", {
      visible: false,
      properties: { biome: "forest" }
    });

    assert.equal(mergeWarnings(world, "B").length, 2);
  });

  test("says nothing about an unknown layer", () => {
    assert.deepEqual(mergeWarnings(makeWorld(), "NoSuch"), []);
  });
});
