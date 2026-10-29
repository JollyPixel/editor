// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeVoxelEntry } from "../voxelEntry.ts";
import { writeVoxel } from "../world.ts";
import {
  ground,
  stack,
  type RoundTripCase
} from "./peers.ts";

export const LAYER_CASES: RoundTripCase[] = [
  {
    name: "adds a layer with its options",
    act: (world) => world.addLayer("Deco", { visible: false, compositing: "replace" }),
    actions: ["added"]
  },
  {
    name: "removes a layer",
    seed: ground,
    act: (world) => world.removeLayer("Ground"),
    actions: ["removed"]
  },
  {
    name: "updates a layer",
    seed: ground,
    act: (world) => world.updateLayer("Ground", { visible: false, anchor: true }),
    actions: ["updated"]
  },
  {
    name: "sets then translates a layer position",
    seed: ground,
    act: (world) => {
      world.setLayerPosition("Ground", { x: 2, y: 0, z: 0 });
      world.translateLayer("Ground", { x: 3, y: 1, z: 0 });
    },
    actions: ["position-updated", "position-updated"],
    check: (remote) => assert.deepEqual(remote.getLayer("Ground")?.position, { x: 5, y: 1, z: 0 })
  },
  {
    name: "rebases a layer without moving its voxels",
    seed: ground,
    act: (world) => world.rebaseLayer("Ground", { x: 1, y: 0, z: 0 }),
    actions: ["position-rebased"],
    check: (remote) => assert.equal(remote.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId, 2)
  },
  {
    name: "swaps a layer with its neighbour",
    seed: stack,
    act: (world) => world.moveLayer("A", "up"),
    actions: ["layer-moved"]
  },
  {
    name: "moves a layer across the stack",
    seed: stack,
    act: (world) => world.moveLayerTo("C", 2),
    actions: ["layer-moved"]
  },
  {
    name: "sets a transformed voxel",
    seed: ground,
    act: (world) => world.setVoxel("Ground", {
      position: { x: 2, y: 0, z: 0 },
      blockId: 3,
      rotation: 1,
      flipX: true
    }),
    actions: ["voxel-set"]
  },
  {
    name: "removes a voxel",
    seed: ground,
    act: (world) => world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } }),
    actions: ["voxel-removed"]
  },
  {
    name: "sets voxels in bulk",
    seed: ground,
    act: (world) => world.setVoxelBulk("Ground", [
      { position: { x: 2, y: 0, z: 0 }, blockId: 3, rotation: 2 },
      { position: { x: 9, y: 0, z: 0 }, blockId: 4 }
    ]),
    actions: ["voxels-set"]
  },
  {
    name: "removes voxels in bulk",
    seed: ground,
    act: (world) => world.removeVoxelBulk("Ground", [
      { position: { x: 0, y: 0, z: 0 } },
      { position: { x: 1, y: 0, z: 0 } }
    ]),
    actions: ["voxels-removed"]
  },
  {
    name: "patches voxels",
    seed: ground,
    act: (world) => world.patchVoxels("Ground", [
      0, 0, 0, 0, 0,
      2, 0, 0, 3, 5,
      9, 0, 0, 4, 0
    ]),
    actions: ["voxels-patched"]
  },
  {
    name: "coalesces a transaction into one patch per layer",
    seed: (world) => {
      world.addLayer("Top");
      ground(world);
    },
    act: (world) => world.transaction(() => {
      world.setVoxel("Ground", { position: { x: 2, y: 0, z: 0 }, blockId: 3, rotation: 1 });
      world.removeVoxel("Ground", { position: { x: 0, y: 0, z: 0 } });
      world.setVoxel("Top", { position: { x: 0, y: 1, z: 0 }, blockId: 6 });
      world.setVoxel("Ground", { position: { x: 2, y: 0, z: 0 }, blockId: 4 });
    }),
    actions: ["voxels-patched", "voxels-patched"]
  },
  {
    name: "turns and mirrors a layer around its center",
    seed: ground,
    act: (world) => world.transformLayer("Ground", { rotation: 1, flipY: true }),
    actions: ["layer-transformed"],
    check: (remote) => assert.equal(remote.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 2)
  },
  {
    name: "folds a layer transform into the transaction patch",
    seed: ground,
    act: (world) => world.transaction(() => {
      world.setVoxel("Ground", { position: { x: 0, y: 0, z: 1 }, blockId: 3 });
      world.transformLayer("Ground", { rotation: 2 });
    }),
    actions: ["voxels-patched"],
    check: (remote) => assert.equal(remote.getVoxelAt({ x: 1, y: 0, z: 0 })?.blockId, 3)
  },
  {
    name: "clones a layer, voxels included, under a derived name",
    seed: (world) => {
      world.addLayer("Bottom");
      ground(world);
    },
    act: (world) => {
      world.cloneLayer("Ground");
      world.cloneLayer("Ground");
    },
    actions: ["cloned", "cloned"],
    check: (remote) => assert.deepEqual(
      remote.getLayers().map((layer) => layer.name),
      ["Ground (1)", "Ground (2)", "Ground", "Bottom"]
    )
  },
  {
    name: "merges a layer and resolves overlaps identically",
    seed: (world) => {
      world.addLayer("Target", { properties: { biome: "forest" } });
      world.addLayer("Source", { properties: { seed: 7 } });
      writeVoxel(world, "Target", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
      writeVoxel(world, "Source", { x: 0, y: 0, z: 0 }, makeVoxelEntry(9));
      writeVoxel(world, "Source", { x: 5, y: 0, z: 0 }, makeVoxelEntry(3));
    },
    act: (world) => world.mergeLayer("Source", "Target"),
    actions: ["merged"],
    check: (remote) => assert.equal(remote.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 9)
  }
];
