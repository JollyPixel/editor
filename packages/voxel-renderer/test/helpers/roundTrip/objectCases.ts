// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeObject } from "../fakes.ts";
import {
  ground,
  mergedGround,
  spawns,
  steps,
  type RoundTripCase
} from "./peers.ts";

export const OBJECT_AND_TEMPLATE_CASES: RoundTripCase[] = [
  {
    name: "adds an object layer",
    act: (world) => world.objectLayers.add("Spawns"),
    actions: ["object-layer-added"]
  },
  {
    name: "removes an object layer",
    seed: spawns,
    act: (world) => world.objectLayers.remove("To"),
    actions: ["object-layer-removed"]
  },
  {
    name: "updates an object layer",
    seed: spawns,
    act: (world) => world.objectLayers.update("From", { visible: false }),
    actions: ["object-layer-updated"]
  },
  {
    name: "adds an object",
    seed: spawns,
    act: (world) => world.objectLayers.addObject("To", makeObject({ id: "obj3", x: 5 })),
    actions: ["object-added"]
  },
  {
    name: "removes an object",
    seed: spawns,
    act: (world) => world.objectLayers.removeObject("From", "obj1"),
    actions: ["object-removed"]
  },
  {
    name: "updates an object",
    seed: spawns,
    act: (world) => world.objectLayers.updateObject("From", "obj1", { x: 10, visible: false }),
    actions: ["object-updated"]
  },
  {
    name: "moves an object between object layers",
    seed: spawns,
    act: (world) => world.objectLayers.moveObject("From", "obj1", "To"),
    actions: ["object-moved"],
    check: (remote) => assert.deepEqual(
      remote.objectLayers.get("To")?.objects.map((object) => object.id),
      ["obj1"]
    )
  },
  {
    name: "creates a template from a layer",
    seed: ground,
    act: (world) => world.templates.createFromLayer("Ground", { name: "Steps" }),
    actions: ["template-defined"],
    check: (remote) => assert.equal(remote.templates.get("template_0")?.voxelCount, 2)
  },
  {
    name: "updates a template",
    seed: steps,
    act: (world) => world.templates.update("steps", { name: "Stairs", properties: { tag: "x" } }),
    actions: ["template-updated"]
  },
  {
    name: "removes a template",
    seed: steps,
    act: (world) => world.templates.remove("steps"),
    actions: ["template-removed"]
  },
  {
    name: "turns a stored template",
    seed: steps,
    act: (world) => world.templates.transform("steps", { rotation: 1 }),
    actions: ["template-defined"],
    check: (remote) => assert.deepEqual(remote.templates.get("steps")?.size, { x: 1, y: 1, z: 2 })
  },
  {
    name: "merges a voxel into an occupied cell",
    seed: ground,
    act: (world) => world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: 3,
      flipY: true,
      merge: true
    }),
    actions: ["voxel-set"],
    check: (remote) => assert.equal(
      remote.getVoxelAt({ x: 0, y: 0, z: 0 })?.partner?.blockId,
      3
    )
  },
  {
    name: "patches merged cells with their second shape",
    seed: ground,
    act: (world) => world.transaction(() => world.setVoxelBulk("Ground", [
      {
        position: { x: 1, y: 0, z: 0 },
        blockId: 3,
        merge: true
      }
    ])),
    actions: ["voxels-patched"],
    check: (remote) => assert.equal(
      remote.getVoxelAt({ x: 1, y: 0, z: 0 })?.partner?.blockId,
      3
    )
  },
  {
    name: "turns both shapes of a merged cell with its layer",
    seed: mergedGround,
    act: (world) => world.transformLayer("Ground", { rotation: 1 }),
    actions: ["layer-transformed"]
  },
  {
    name: "places a turned template as a voxel patch",
    seed: steps,
    act: (world) => world.templates.place("steps", {
      layerName: "Ground",
      position: { x: 5, y: 0, z: 5 },
      transform: { rotation: 3, flipY: true }
    }),
    actions: ["voxels-patched"]
  }
];
